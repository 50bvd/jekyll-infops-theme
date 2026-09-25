---
layout: post
title: "Proxmox 8 on a Mac Pro 3.1 — Installation, ZFS raidz1 and the Harpertown fix"
date: 2026-04-15
author: "50bvd"
categories: [Homelab, Virtualization]
tags: [proxmox, zfs, mac-pro, homelab, virtualization, harpertown, kvm]
description: "Field notes on installing Proxmox 8.4 on a Mac Pro 3.1 (dual Xeon Harpertown, 2008), a ZFS raidz1 pool, and the fix for the MSR IA32_DEBUGCTL bug."
image: /assets/images/posts/proxmox-cover.jpg
image_light: /assets/images/posts/proxmox-light.svg
---

The Mac Pro 3.1 (2008) is an underrated homelab platform: quiet, expandable, and available for under €200 second-hand. This guide covers a complete Proxmox 8.4 installation with ZFS raidz1 and the fixes specific to Harpertown CPUs.

## Hardware

| Component | Details |
|-----------|---------|
| Model | Mac Pro 3.1 (Early 2008) |
| CPU | 2× Intel Xeon E5462 (Harpertown, 4c/4t × 2 = 8 threads) |
| RAM | 32 GB DDR2 ECC 800 MHz |
| Boot storage | 120 GB SSD (SATA through an adapter) |
| Data storage | 4× 2 TB HDD (ZFS raidz1) |

## Installing Proxmox

Write the ISO to a USB stick:

```bash
dd if=proxmox-ve_8.4.iso of=/dev/sdX bs=4M status=progress
```

When the Mac Pro starts, hold **Option** to pick the USB stick. The Mac Pro 3.1 boots in legacy BIOS mode — if the stick doesn't show up, try another USB port (the rear ports work better).

{% include screenshot.html src="/assets/images/posts/proxmox-mac-pro/01-boot-picker.jpg" alt="Mac Pro boot picker showing the USB stick" caption="Holding **Option** at startup: the Mac Pro boot picker with the Proxmox USB stick" %}

{% include callout.html type="warning" title="EFI boot" content="The Mac Pro 3.1 can be picky with some USB sticks. If it gets stuck, burn a DVD or use rEFInd as an intermediate boot loader." %}

## Bug — MSR IA32_DEBUGCTL (Harpertown)

After installation, VMs crash with this error in the KVM logs:

```
kvm: vcpu0, guest rip=0xffffffff8104b90c, error 1,
     info 0: MSR_IA32_DEBUGCTL error
```

This is a known bug with Harpertown Xeons (Penryn architecture) — these CPUs don't fully support the `IA32_DEBUGCTL` register KVM expects.

### Fix

```bash
# Option 1: set the module parameter
echo "options kvm-intel ignore_msrs=Y" > /etc/modprobe.d/kvm-intel.conf

# Reload without rebooting
modprobe -r kvm_intel
modprobe kvm_intel ignore_msrs=Y

# Check
cat /sys/module/kvm_intel/parameters/ignore_msrs
# → Y

# Make it permanent
update-initramfs -u -k all
```

{% capture term3 %}
# cat /sys/module/kvm_intel/parameters/ignore_msrs
Y
{% endcapture %}
{% include terminal.html content=term3 title="root@macpro" prompt="root@macpro:~" caption="`ignore_msrs` is active: KVM no longer crashes on Harpertown" %}

After a reboot, VMs start and run stably.

## Setting up the ZFS raidz1 pool

Raidz1 with four 2 TB disks = **6 TB usable** (one parity disk).

```bash
# Identify the disks by stable ID (avoid /dev/sdX, which can change)
ls -la /dev/disk/by-id/ | grep -v part | grep ata

# Create the pool
zpool create -o ashift=12 \
  -O compression=lz4 \
  -O atime=off \
  -O xattr=sa \
  -O dnodesize=auto \
  datastore raidz1 \
  /dev/disk/by-id/ata-DISK1 \
  /dev/disk/by-id/ata-DISK2 \
  /dev/disk/by-id/ata-DISK3 \
  /dev/disk/by-id/ata-DISK4

# Check
zpool status
zfs list
```

### Recommended settings

```bash
# Cap the ARC at 8 GB (so it doesn't eat the RAM the VMs need)
echo "options zfs zfs_arc_max=8589934592" > /etc/modprobe.d/zfs.conf

# Weekly scrub (already set up by Proxmox)
systemctl status zfs-scrub.timer
```

### Adding the datastore to Proxmox

```bash
pvesm add zfspool datastore \
  --pool datastore \
  --sparse 1 \
  --content images,rootdir
```

Or in the web interface: **Datacenter → Storage → Add → ZFS**.

{% include screenshot.html src="/assets/images/posts/proxmox-mac-pro/02-add-zfs-storage.png" alt="Proxmox Add ZFS storage dialog" caption="**Datacenter → Storage → Add → ZFS** with the `datastore` pool" %}

## SSD as an L2ARC cache (optional)

```bash
# Add an SSD as a read cache
zpool add datastore cache /dev/disk/by-id/ata-SSD

# Check
zpool status
# → cache: SSD listed
```

## Bridged network configuration

```bash
# /etc/network/interfaces
auto lo
iface lo inet loopback

auto enp0s3
iface enp0s3 inet manual

auto vmbr0
iface vmbr0 inet static
    address 192.168.1.10/24
    gateway 192.168.1.1
    bridge-ports enp0s3
    bridge-stp off
    bridge-fd 0
```

## Observed performance

After several months with 8-10 VMs running at the same time:

| Metric | Value |
|--------|-------|
| Average CPU | 15-40% |
| RAM used | 22-28 GB / 32 |
| ZFS I/O (seq read) | ~150 MB/s |
| ZFS I/O (seq write) | ~80 MB/s |
| CPU temperature | 45-55°C |

The Mac Pro's (axial, very quiet) cooling handles the heat perfectly, even under load.

{% include screenshot.html src="/assets/images/posts/proxmox-mac-pro/03-node-summary.png" alt="Proxmox node summary graphs" caption="Node summary in Proxmox: CPU, RAM and load over several months" %}

## Conclusion

The Mac Pro 3.1 is a solid homelab base despite being 16 years old. The only real hurdle is the `ignore_msrs` bug — once fixed, everything runs perfectly on Proxmox 8.4.

{% include callout.html type="tip" title="RAM" content="The Mac Pro 3.1 takes up to 32 GB of DDR2 ECC in 8 slots. Paired modules matter for performance. Buy kits tested for the Mac Pro." %}

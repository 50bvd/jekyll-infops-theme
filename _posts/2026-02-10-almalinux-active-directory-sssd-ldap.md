---
layout: post
title: "Joining AlmaLinux 9 to an Active Directory domain with SSSD"
date: 2026-02-10
author: "50bvd"
categories: [Infrastructure, Linux]
tags: [ldap, active-directory, almalinux, sssd, linux, authentication]
description: "Complete guide to joining an AlmaLinux 9 server to an Active Directory domain — LDAP/Kerberos authentication, AD-based sudo, automatic home directories."
image: /assets/images/posts/ldap-almalinux-cover.jpg
image_light: /assets/images/posts/ldap-almalinux-light.svg
---

Joining a Linux server to an Active Directory domain lets domain users log in with their AD credentials and benefit from centralized policies. Here is how to do it cleanly on AlmaLinux 9 with SSSD and realmd.

## Prerequisites

- An up-to-date AlmaLinux 9
- Network access to the domain controller (ports 88, 389, 636, 3268, 3269)
- An AD account allowed to join machines to the domain
- DNS set up to resolve the AD domain

## Checking the network

```bash
# Check DNS resolution of the AD domain
dig +short domain.local _ldap._tcp.domain.local SRV
# → must return the DC's IP and LDAP port

# Ping the DC
ping dc1.domain.local

# Check the required ports
for port in 88 389 636; do
  nc -zv dc1.domain.local $port && echo "Port $port OK" || echo "Port $port CLOSED"
done
```

{% include callout.html type="warning" title="DNS is critical" content="DNS must resolve the AD domain and its SRV records. Set the DCs as DNS servers in /etc/resolv.conf before you start." %}

## Configuring DNS

```bash
# /etc/resolv.conf
search domain.local
nameserver 192.168.x.10   # DC1
nameserver 192.168.x.11   # DC2

# Check
nslookup domain.local
nslookup dc1.domain.local
```

## Installing the packages

```bash
dnf install -y \
  realmd \
  sssd \
  sssd-ad \
  sssd-tools \
  oddjob \
  oddjob-mkhomedir \
  adcli \
  samba-common-tools \
  krb5-workstation \
  openldap-clients
```

## Joining the domain

```bash
# Discover the domain (without joining)
realm discover domain.local

# Join the domain
realm join -U administrator domain.local
# Enter the AD account password when prompted

# Check the join
realm list
```

Expected output:

{% capture term14 %}
# realm list
domain.local
  type: kerberos
  realm-name: DOMAIN.LOCAL
  domain-name: domain.local
  configured: kerberos-member
  server-software: active-directory
  client-software: sssd
  required-package: oddjob
  required-package: oddjob-mkhomedir
  required-package: sssd
  required-package: adcli
  required-package: samba-common-tools
  login-formats: %U@domain.local
  login-policy: allow-realm-logins
{% endcapture %}
{% include terminal.html content=term14 title="root@alma9" prompt="root@alma9:~" caption="The server is a Kerberos member of the domain, with SSSD as client" %}

{% include screenshot.html src="/assets/images/posts/almalinux-ad/02-aduc-computer-account.png" alt="The server computer account in Active Directory" caption="The server's computer account created by `realm join` in *Active Directory Users and Computers*" %}

## SSSD configuration

`/etc/sssd/sssd.conf` is generated automatically by `realm join`, but a few adjustments are recommended:

```ini
# /etc/sssd/sssd.conf
[sssd]
domains = domain.local
config_file_version = 2
services = nss, pam

[domain/domain.local]
default_shell = /bin/bash
krb5_store_password_if_offline = True
cache_credentials = True
krb5_realm = DOMAIN.LOCAL
realmd_tags = manages-system joined-with-adcli
id_provider = ad
fallback_homedir = /home/%u@%d
ad_domain = domain.local
use_fully_qualified_names = False    # ← log in without @domain.local
ldap_id_mapping = True
access_provider = ad

# Performance
ad_gpo_access_control = disabled    # Disable Linux GPO enforcement (optional)
ldap_referrals = false

# Cache
cache_credentials = true
offline_credentials_expiration = 7

# Timeouts
ldap_network_timeout = 3
ldap_opt_timeout = 3
```

{% include callout.html type="tip" title="use_fully_qualified_names = False" content="Without this option, users must log in as user@domain.local. With False, 'user' is enough — much more convenient." %}

```bash
# Apply the permissions (mandatory)
chmod 600 /etc/sssd/sssd.conf

# Restart SSSD
systemctl restart sssd
systemctl enable sssd
```

## Automatic home directory creation

```bash
# Create the home directory automatically on first login
authselect select sssd with-mkhomedir --force

# Enable the oddjobd service
systemctl enable --now oddjobd
```

## Testing authentication

```bash
# Check that an AD user is visible
id user@domain.local
# With use_fully_qualified_names = False:
id user

# Test Kerberos authentication
kinit administrator@DOMAIN.LOCAL
klist   # Shows the Kerberos ticket

# Test an SSH login with an AD account
ssh user@localhost
```

## Allowing only some AD groups

By default, every AD user can log in. Restrict access:

```bash
# Allow only the "Linux-Admins" AD group
realm permit -g 'Linux-Admins@domain.local'

# Deny everyone except the allowed groups
realm deny --all
realm permit -g 'Linux-Admins@domain.local'
realm permit -g 'Linux-Users@domain.local'

# Check
realm list
```

{% include screenshot.html src="/assets/images/posts/almalinux-ad/01-aduc-linux-admins.png" alt="Linux-Admins group in Active Directory Users and Computers" caption="The **Linux-Admins** group in *Active Directory Users and Computers*" %}

## Sudo through Active Directory groups

Create a sudoers file for your AD groups:

```bash
# /etc/sudoers.d/ad-admins
# Full sudo for the "Linux-Admins" AD group
%Linux-Admins@domain.local ALL=(ALL) ALL

# Passwordless sudo for infrastructure admins
%Linux-Infra-Admins@domain.local ALL=(ALL) NOPASSWD: ALL
```

```bash
# Check the syntax
visudo -c -f /etc/sudoers.d/ad-admins

# Test
su - admin-user@domain.local
sudo whoami   # → root
```

{% capture term2 %}
$ sudo whoami
root
{% endcapture %}
{% include terminal.html content=term2 title="SSH — admin-user@alma9" prompt="admin-user@alma9:~" caption="An AD user from **Linux-Admins** gets root through sudo" %}

## Common problems

### SSSD won't start

```bash
journalctl -u sssd -n 50 --no-pager

# Frequent culprit: sssd.conf permissions
chmod 600 /etc/sssd/sssd.conf
chown root:root /etc/sssd/sssd.conf

# Clear the SSSD cache (for "ghost" users)
sss_cache -E
systemctl restart sssd
```

### AD user not found

```bash
# Test the LDAP connection directly
ldapsearch -H ldap://dc1.domain.local \
  -D "CN=svc-linux,OU=Services,DC=domain,DC=local" \
  -w PASS \
  -b "DC=domain,DC=local" \
  "(sAMAccountName=user)"

# Force a refresh
sss_cache -u user
id user
```

### Expired or invalid Kerberos ticket

```bash
# Check the ticket
klist

# Renew it manually
kinit user@DOMAIN.LOCAL

# Sync the clock (Kerberos is sensitive to drift)
timedatectl status
chronyc tracking

# If the drift is > 5 min → Kerberos fails
chronyc makestep
```

## Leaving the domain

```bash
realm leave domain.local
# The computer account is removed from AD
```

## Final check

```bash
# Full test
getent passwd user              # The user is visible
getent group 'Linux-Admins'     # The AD group is visible
su - user                       # Login → home created automatically
sudo -l                         # Correct sudo rights
```

{% include callout.html type="success" title="Result" content="AD users can now SSH into the Linux server with their domain credentials. Their home directory is created automatically on first login." %}

## Special case — authentication without joining (simple LDAP bind)

If you can't join the machine to the domain (restricted environments), an alternative is a simple LDAP bind with `nslcd`:

```bash
dnf install -y nss-pam-ldapd nslcd

# /etc/nslcd.conf
uri ldap://dc1.domain.local
base dc=domain,dc=local
binddn CN=svc-linux,OU=Services,DC=domain,DC=local
bindpw YOUR_PASSWORD
ssl start_tls
tls_reqcert never
scope sub
filter passwd (&(objectClass=user)(memberOf=CN=Linux-Users,OU=Groups,DC=domain,DC=local))
map passwd uid sAMAccountName
map passwd homeDirectory unixHomeDirectory
map passwd gecos displayName
```

This method is less integrated (no Kerberos, no SSO) but works in constrained environments.

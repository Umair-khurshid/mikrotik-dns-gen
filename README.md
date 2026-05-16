# MikroTik DNS Static Config Generator

A client-side tool that converts a list of domain names into `/ip dns static add` commands for MikroTik RouterOS. Paste domains, configure parameters, get copy-paste-ready RouterOS config.

**[Link:](https://umair-khurshid.github.io/mikrotik-dns-gen/)**

## Features

- 
- **Syntax highlighted output**: domain names, keywords, and comments are color-coded
- **Bulk processing**:supports wildcards (`*.example.com`), inline comments, and blank lines
- **Download .rsc**: save commands as a `.rsc` file for RouterOS import
- **Auto-save**: domain list and parameters persist in `localStorage` across sessions

## Usage

1. **Paste your domain list** in the text area — one domain per line, `#` for comments
2. **Set the `address-list` name** (required) — e.g., `split-dns`, `vpn-routing`
3. **Optionally configure `forward-to`** — DNS server IP to forward matching queries to (RouterOS v6+)
4. **Optionally add a `comment`** — included in every generated entry
5. **Click Generate** (or press `Ctrl+Enter`)
6. **Copy** the output or **download** it as a `.rsc` file

### Example

**Input:**
```
example.com
*.example.com
api.example.com
# internal services
internal.example.com
```

**Output:**
```
# Generated: 20260516-143022
# Domains: 4

/ip dns static add address-list="split-dns" forward-to="10.0.0.1" name="example.com"
/ip dns static add address-list="split-dns" forward-to="10.0.0.1" name="*.example.com"
/ip dns static add address-list="split-dns" forward-to="10.0.0.1" name="api.example.com"
/ip dns static add address-list="split-dns" forward-to="10.0.0.1" name="internal.example.com"
```



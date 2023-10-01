# luci-app-mosdns

[MosDNS](https://github.com/IrineSistiana/mosdns) is a plug-in DNS forwarder. Users can splicing plug-ins as needed to customize their own DNS processing logic.

## DNS protocol standard

**General DNS (UDP):** `119.29.29.29` **&** `udp://119.29.29.29:53`

**General DNS (TCP):** `tcp://119.29.29.29` **&** `tcp://119.29.29.29:53`

**DNS-over-TLS:** `tls://120.53.53.53` **&** `tls://120.53.53.53:853`

**DNS-over-HTTPS:** `https://120.53.53.53/dns-query`

**DNS-over-HTTPS (HTTP/3):** `h3://dns.alidns.com/dns-query`

**DNS-over-QUIC:** `quic://dns.alidns.com` **&** `doq://dns.alidns.com`

--------------

## How to build

- Enter in your openwrt dir

- Openwrt official SnapShots

  * requires golang 1.20.x or latest version (openwrt-21.02 & older version needs)
  ```shell
  rm -rf feeds/packages/lang/golang
  git clone https://github.com/sbwml/packages_lang_golang -b 20.x feeds/packages/lang/golang
  ```

  ```shell
  # remove v2ray-geodata package from feeds (openwrt-22.03 & master)
  rm -rf feeds/packages/net/v2ray-geodata

  git clone https://github.com/sbwml/luci-app-mosdns -b v5 package/mosdns
  git clone https://github.com/sbwml/v2ray-geodata package/v2ray-geodata
  make menuconfig # choose LUCI -> Applications -> luci-app-mosdns
  make package/mosdns/luci-app-mosdns/compile V=s
  ```

- Non-Openwrt official source

  ```shell
  # drop mosdns and v2ray-geodata packages that come with the source
  find ./ | grep Makefile | grep v2ray-geodata | xargs rm -f
  find ./ | grep Makefile | grep mosdns | xargs rm -f

  git clone https://github.com/sbwml/luci-app-mosdns -b v5 package/mosdns
  git clone https://github.com/sbwml/v2ray-geodata package/v2ray-geodata
  make menuconfig # choose LUCI -> Applications -> luci-app-mosdns
  make package/mosdns/luci-app-mosdns/compile V=s
  ```

--------------

## How to install prebuilt packages

- Login OpenWrt terminal (SSH)

- Install `curl` package
  ```shell
  opkg update
  opkg install curl
  ```

- Execute install script (Multi-architecture support)
  ```shell
  sh -c "$(curl -ksS https://raw.githubusercontent.com/sbwml/luci-app-mosdns/v5/install.sh)"
  ```

--------------

## Preview Images

![1](https://github.com/sbwml/luci-app-mosdns/assets/16485166/3118d6eb-cc47-4411-8fd7-f84fe60b84ed)

![2](https://github.com/sbwml/luci-app-mosdns/assets/16485166/a23da446-7751-4944-a2d0-56049142729c)

![3](https://github.com/sbwml/luci-app-mosdns/assets/16485166/941d2bc9-5e12-42bf-980e-3faebe83e6e8)

![4](https://github.com/sbwml/luci-app-mosdns/assets/16485166/aaefee1f-6396-4b99-badf-86fe1a49cf4b)

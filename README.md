# luci-app-mosdns

[MosDNS](https://github.com/IrineSistiana/mosdns) is a plug-in DNS forwarder. Users can splicing plug-ins as needed to customize their own DNS processing logic.

## How to build

- Enter in your openwrt dir

- Openwrt official SnapShots

  ```shell
  git clone https://github.com/sbwml/luci-app-mosdns package/mosdns
  git clone https://github.com/sbwml/v2ray-geodata package/geodata
  make menuconfig # choose LUCI -> Applications -> luci-app-mosdns
  make V=s
  ```

--------------

## How to install prebuilt packages (OpenWrt 18 & 19 & 21 & 22 & master)

- Login OpenWrt terminal (SSH)

- Install `curl` package
  ```shell
  opkg update
  opkg install curl
  ```

- Execute install script (Multi-architecture support)
  ```shell
  sh -c "$(curl -ksS https://raw.githubusercontent.com/sbwml/luci-app-mosdns/master/install.sh)"
  ```

--------------

![](https://user-images.githubusercontent.com/16485166/184607725-a147edda-07a0-41e9-be33-83b878926e6c.png)


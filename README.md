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

## How to install prebuilt packages (OpenWrt 21 & 22 & master)

- Login OpenWrt terminal (SSH)

- Install `curl` package
  ```shell
  opkg update
  opkg install curl
  ```

- Execute install script (Multi-architecture support)
  ```shell
  sh -c "$(curl -sS https://raw.githubusercontent.com/sbwml/luci-app-mosdns/master/install.sh)"
  ```

--------------

![](https://user-images.githubusercontent.com/16485166/182749575-d09fb4f9-4f23-4aa9-9714-ba0c7da6d37c.png)

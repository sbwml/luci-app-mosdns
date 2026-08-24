#
# Copyright (C) 2015-2016 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v3.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=geo2txt
PKG_VERSION:=2026.08.25
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/sbwml/geo2txt.git
PKG_SOURCE_VERSION:=29a4fe1db193ace6627d5385b007bfec08037b0e
PKG_MIRROR_HASH:=0412c063443b309fa9534363df586d40967894022cb2aed28738302e17c2ac16

PKG_LICENSE:=GPL-3.0
PKG_LICENSE_FILE:=LICENSE
PKG_MAINTAINER:=sbwml <admin@cooluc.com>

PKG_BUILD_DEPENDS:=golang/host
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

GO_PKG:=github.com/sbwml/geo2txt

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

define Package/geo2txt
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=V2ray geosite & geoip unpacking CLI tool
  URL:=https://github.com/sbwml/geo2txt
  DEPENDS:=$(GO_ARCH_DEPENDS)
endef

define Package/geo2txt/install
	$(call GoPackage/Package/Install/Bin,$(1))
endef

$(eval $(call GoBinPackage,geo2txt))
$(eval $(call BuildPackage,geo2txt))

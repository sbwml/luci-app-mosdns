#
# Copyright (C) 2015-2016 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v3.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=geo2txt
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/sbwml/geo2txt/tar.gz/$(PKG_VERSION)?
PKG_HASH:=610a43ffddd3a435e112ff6310af2f976fad1f03059b15aa43be52a7e4e49232

PKG_LICENSE:=GPL-3.0
PKG_LICENSE_FILE:=LICENSE
PKG_MAINTAINER:=sbwml <admin@cooluc.com>

include $(INCLUDE_DIR)/package.mk

define Package/geo2txt
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=V2ray geosite & geoip unpacking CLI tool
  URL:=https://github.com/sbwml/geo2txt
endef

define Package/quickfile/description
  A lightweight pure C utility to unpack v2ray geosite.dat and geoip.dat.
endef

define Package/geo2txt/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/geo2txt $(1)/usr/bin/geo2txt
endef

$(eval $(call BuildPackage,geo2txt))

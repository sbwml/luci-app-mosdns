#!/bin/sh
RED_COLOR='\e[1;31m'
GREEN_COLOR='\e[1;32m'
RES='\e[0m'

# OpenWrt Info
if [ -f /etc/openwrt_release ]; then
	. /etc/openwrt_release
	version=$(echo ${DISTRIB_RELEASE%%.*})
	platform=$(echo $DISTRIB_ARCH)
else
	echo -e "${RED_COLOR}Unknown OpenWRT Version${RES}"
	exit 1
fi

# TMP
TMPDIR=$(mktemp -d) || exit 1

# GitHub mirror
ip_info=$(curl -sk https://ip.cooluc.com)
country_code=$(echo $ip_info | sed -r 's/.*country_code":"([^"]*).*/\1/')
if [ $country_code = "CN" ]; then
	google_status=$(curl -I -4 -m 3 -o /dev/null -s -w %{http_code} http://www.google.com/generate_204)
	if [ ! $google_status = "204" ];then
		mirror="https://gh.cooluc.com/"
	fi
fi

# Check
CHECK() (
	echo -e "\r\n${GREEN_COLOR}Checking available space  ...${RES}"
	ROOT_SPACE=$(df -m /usr | awk 'END{print $4}')
	if [ $ROOT_SPACE -lt 40 ]; then
		echo -e "\r\n${RED_COLOR}Error, The system storage space is less than 40MB.${RES}"
		exit 1;
	fi
	echo -e "\r\n${GREEN_COLOR}Checking platform  ...${RES}\r\n"
	prebuilt="aarch64_cortex-a53 aarch64_cortex-a72 aarch64_generic arm_arm1176jzf-s_vfp arm_arm926ej-s arm_cortex-a15_neon-vfpv4 arm_cortex-a5_vfpv4 arm_cortex-a7 arm_cortex-a7_neon-vfpv4 arm_cortex-a8_vfpv3 arm_cortex-a9 arm_cortex-a9_neon arm_cortex-a9_vfpv3-d16 arm_fa526 arm_mpcore arm_xscale i386_pentium-mmx i386_pentium4 mips64_octeonplus mips_24kc mips_4kec mips_mips32 mipsel_24kc mipsel_24kc_24kf mipsel_74kc mipsel_mips32 x86_64"
	verif=$(expr match "$prebuilt" ".*\($platform\)")
	if [[ ! $verif ]]; then
		echo -e "${RED_COLOR}Error! The current \"$platform\" platform is not currently supported.${RES}"
		exit 1;
	else
		echo -e "${GREEN_COLOR}Update opkg sources ...${RES}"
		opkg update
		opkg install luci-compat
	fi
)

DOWNLOAD() (
	echo -e "\r\n${GREEN_COLOR}Download Packages ...${RES}\r\n"
	# get repos info
	mosdns_version=`curl -sk https://api.github.com/repos/sbwml/luci-app-mosdns/releases | grep "tag_name" | grep v5 | head -n 1 | awk -F ":" '{print $2}' | sed 's/\"//g;s/,//;s/ //'`
	curl -sk --connect-timeout 10 "https://api.github.com/repos/sbwml/luci-app-mosdns/releases" | grep "browser_download_url" | grep "$mosdns_version" > $TMPDIR/releases.txt
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Failed to get version information, Please check the network status.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
	mosdns=$(cat $TMPDIR/releases.txt | grep "browser_download_url" | grep mosdns_5 | grep $platform.ipk | head -1 | awk '{print $2}' | sed 's/\"//g')
	v2dat=$(cat $TMPDIR/releases.txt | grep "browser_download_url" | grep v2dat_ | grep $platform.ipk | head -1 | awk '{print $2}' | sed 's/\"//g')
	luci_app=$(cat $TMPDIR/releases.txt | grep "browser_download_url" | grep luci-app-mosdns_ | head -1 | awk '{print $2}' | sed 's/\"//g')
	luci_i18n=$(cat $TMPDIR/releases.txt | grep "browser_download_url" | grep luci-i18n-mosdns-zh-cn | head -1 | awk '{print $2}' | sed 's/\"//g')
	geoip=$(cat $TMPDIR/releases.txt | grep "browser_download_url" | grep v2ray-geoip | head -1 | awk '{print $2}' | sed 's/\"//g')
	geosite=$(cat $TMPDIR/releases.txt | grep "browser_download_url" | grep v2ray-geosite | head -1 | awk '{print $2}' | sed 's/\"//g')

	# download
	echo -e "${GREEN_COLOR}Download $mosdns ...${RES}"
	curl --connect-timeout 30 -m 600 -kLo "$TMPDIR/mosdns_$platform.ipk" $mirror$mosdns
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Error! download $mosdns failed.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
	echo -e "${GREEN_COLOR}Download $v2dat ...${RES}"
	curl --connect-timeout 30 -m 600 -kLo "$TMPDIR/v2dat_$platform.ipk" $mirror$v2dat
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Error! download $v2dat failed.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
	echo -e "${GREEN_COLOR}Download $luci_app ...${RES}"
	curl --connect-timeout 30 -m 600 -kLo "$TMPDIR/luci-app-mosdns.ipk" $mirror$luci_app
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Error! download $luci_app failed.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
	echo -e "${GREEN_COLOR}Download $luci_i18n ...${RES}"
	curl --connect-timeout 30 -m 600 -kLo "$TMPDIR/luci-i18n-mosdns-zh-cn.ipk" $mirror$luci_i18n
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Error! download $luci_i18n failed.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
	echo -e "${GREEN_COLOR}Download $geoip ...${RES}"
	curl --connect-timeout 30 -m 600 -kLo "$TMPDIR/geoip.ipk" $mirror$geoip
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Error! download $geoip failed.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
	echo -e "${GREEN_COLOR}Download $geosite ...${RES}"
	curl --connect-timeout 30 -m 600 -kLo "$TMPDIR/geosite.ipk" $mirror$geosite
	if [ $? -ne 0 ]; then
		echo -e "${RED_COLOR}Error! download $geosite failed.${RES}"
		rm -rf $TMPDIR
		exit 1
	fi
)

INSTALL() (
	# Install
	echo -e "\r\n${GREEN_COLOR}Install Packages ...${RES}\r\n"
	opkg install --force-overwrite $TMPDIR/geoip.ipk
	opkg install --force-overwrite $TMPDIR/geosite.ipk
	opkg install $TMPDIR/v2dat_$platform.ipk
	opkg install $TMPDIR/mosdns_$platform.ipk
	opkg install $TMPDIR/luci-app-mosdns.ipk
	opkg install $TMPDIR/luci-i18n-mosdns-zh-cn.ipk
	rm -rf $TMPDIR /tmp/luci-*
	echo -e "${GREEN_COLOR}Done!${RES}"
)

CHECK && DOWNLOAD && INSTALL

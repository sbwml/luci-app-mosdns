#!/bin/bash -e

adblock=$(uci -q get mosdns.mosdns.adblock)
if [ "$adblock" -eq 1 ];then
	echo "ext:/usr/share/v2ray/geosite.dat:category-ads-all"
fi

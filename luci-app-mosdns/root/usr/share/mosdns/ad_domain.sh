#!/bin/sh

adblock=$(uci -q get mosdns.mosdns.adblock)
if [ "$adblock" -eq 1 ];then
	echo "provider:geosite:category-ads-all"
else
	echo "full:disable-category-ads-all.null"
fi

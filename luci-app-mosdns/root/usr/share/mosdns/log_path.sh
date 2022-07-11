#!/bin/bash -e

configfile=$(uci -q get mosdns.mosdns.configfile)
if [ "$configfile" = "/etc/mosdns/config.yaml" ]; then
	uci -q get mosdns.mosdns.logfile
else
	[ ! -f /etc/mosdns/config_custom.yaml ] && exit 1
	cat /etc/mosdns/config_custom.yaml | grep -A 3 log | grep file | awk -F ":" '{print $2}' | sed 's/\"//g;s/ //g'
fi

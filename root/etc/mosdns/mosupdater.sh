#!/bin/bash -e
# shellcheck source=/etc/mosdns/library.sh

set -o pipefail
source /etc/mosdns/library.sh

TMPDIR=$(mktemp -d) || exit 1
getdat geoip.dat
getdat geosite.dat
find "$TMPDIR"/* -size -20k -exec rm {} \;
cp -rf "$TMPDIR"/* /usr/share/v2ray
rm -rf "$TMPDIR"

syncconfig=$(uci -q get mosdns.mosdns.syncconfig)
if [ "$syncconfig" -eq 1 ]; then
	TMPDIR=$(mktemp -d) || exit 2
	getdat def_config.yaml
	getdat serverlist.txt
	find "$TMPDIR"/* -size -2k -exec rm {} \;
	cp -rf "$TMPDIR"/* /etc/mosdns
	rm -rf /etc/mosdns/serverlist.bak
fi

exit 0

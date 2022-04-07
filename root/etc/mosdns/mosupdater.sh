#!/bin/bash -e
# shellcheck source=/etc/mosdns/library.sh

set -o pipefail
source /etc/mosdns/library.sh

TMPDIR=$(mktemp -d) || exit 1
getdat geoip.dat
getdat geosite.dat
if [ "$(grep -o CN "$TMPDIR"/geoip.dat | wc -l)" -eq "0" ]; then
  rm -rf "$TMPDIR"/geoip.dat
fi
if [ "$(grep -o .com "$TMPDIR"/geosite.dat | wc -l)" -lt "1000" ]; then
  rm -rf "$TMPDIR"/geosite.dat
fi
cp -rf "$TMPDIR"/* /usr/share/v2ray
rm -rf "$TMPDIR"

update_adlist=$(uci -q get mosdns.mosdns.update_adlist)
if [ "$update_adlist" -eq 1 ]; then
  TMPDIR=$(mktemp -d) || exit 2
  get_adlist serverlist.txt
  if [ "$(grep -o .com "$TMPDIR"/serverlist.txt | wc -l)" -lt "1000" ]; then
    rm -rf "$TMPDIR"/serverlist.txt
  fi
  cp -rf "$TMPDIR"/* /etc/mosdns
  rm -rf /etc/mosdns/serverlist.bak
fi
exit 0

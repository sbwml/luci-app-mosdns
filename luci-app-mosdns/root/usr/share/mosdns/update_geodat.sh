#!/bin/bash -e
# shellcheck source=/etc/mosdns/library.sh

set -o pipefail
source /usr/share/mosdns/library.sh

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

exit 0

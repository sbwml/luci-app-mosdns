#!/bin/sh

script_action=${1}

logfile_path() {
    configfile=$(uci -q get mosdns.config.configfile)
    if [ "$configfile" = "/var/etc/mosdns.json" ]; then
        uci -q get mosdns.config.log_file
    else
        [ ! -f /etc/mosdns/config_custom.yaml ] && exit 1
        awk '/^log:/{f=1;next}f==1{if($0~/file:/){print;exit}if($0~/^[^ ]/)exit}' /etc/mosdns/config_custom.yaml | grep -Eo "/[^'\"]+"
    fi
}

print_logfile() {
    cat $(logfile_path);
}

clean_logfile() {
    true > $(logfile_path);
}

default_interface_dns() (
    dns=""
    peerdns=$(uci -q get network.wan.peerdns)
    proto=$(uci -q get network.wan.proto)
    if [ "$peerdns" = 0 ] || [ "$proto" = "static" ]; then
        dns=$(uci -q get network.wan.dns)
    else
        interface_status=$(ubus call network.interface.wan status)
        dns1=$(echo "$interface_status" | jsonfilter -e "@['dns-server'][0]")
        dns2=$(echo "$interface_status" | jsonfilter -e "@['dns-server'][1]")
        dns="$dns1 $dns2"
    fi
    dns=$(echo "$dns" | xargs)
    [ -n "$dns" ] && echo "$dns" || echo "119.29.29.29 223.5.5.5"
)

interface_dns() (
    if [ "$(uci -q get mosdns.config.custom_local_dns)" = 1 ]; then
        uci -q get mosdns.config.local_dns
    else
        default_interface_dns
    fi
)

get_adlist() (
    adblock=$(uci -q get mosdns.config.adblock)
    if [ "$adblock" = 1 ]; then
        mkdir -p /etc/mosdns/rule/adlist
        ad_source=$(uci -q get mosdns.config.ad_source)
        for url in $ad_source;
        do
            case "$url" in
                geosite.dat)
                    echo "/var/mosdns/geosite_category-ads-all.txt"
                ;;
                https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-domains.txt|\
                https://raw.githubusercontent.com/Cats-Team/AdRules/main/mosdns_adrules.txt|\
                https://raw.githubusercontent.com/neodevpro/neodevhost/master/domain)
                    echo "/etc/mosdns/rule/adlist/$(basename $url)"
                    [ ! -f "/etc/mosdns/rule/adlist/$(basename $url)" ] && touch /etc/mosdns/rule/adlist/$(basename $url)
                ;;
            esac
        done
    else
        rm -rf /etc/mosdns/rule/adlist /etc/mosdns/rule/.ad_source
        touch /var/mosdns/disable-ads.txt
        echo "/var/mosdns/disable-ads.txt"
    fi
)

adlist_update() {
    [ "$(uci -q get mosdns.config.adblock)" != 1 ] && return 0
    lock_file=/var/lock/mosdns_ad_update.lock
    ad_source=$(uci -q get mosdns.config.ad_source)
    : > /etc/mosdns/rule/.ad_source
    if [ -f "$lock_file" ]; then
        has_update=0
        exit 0
    else
        : > $lock_file
    fi
    AD_TMPDIR=$(mktemp -d) || exit 1
    has_update=0
    for url in $ad_source;
    do
        case "$url" in
            geosite.dat)
                continue
            ;;
            https://raw.githubusercontent.com/privacy-protection-tools/anti-AD/master/anti-ad-domains.txt|\
            https://raw.githubusercontent.com/Cats-Team/AdRules/main/mosdns_adrules.txt|\
            https://raw.githubusercontent.com/neodevpro/neodevhost/master/domain)
                has_update=1
                echo "$url" >> /etc/mosdns/rule/.ad_source
                filename=$(basename $url)
                [ -n "$(uci -q get mosdns.config.github_proxy)" ] && mirror="$(uci -q get mosdns.config.github_proxy)/" || mirror=""
                echo -e "Downloading $mirror$url"
                curl --connect-timeout 5 -m 90 --ipv4 -kfSLo "$AD_TMPDIR/$filename" "$mirror$url"
            ;;
        esac
    done
    if [ $? -ne 0 ]; then
        echo -e "\e[1;31mRules download failed."
        rm -rf "$AD_TMPDIR" "$lock_file"
        exit 1
    else
        [ $has_update -eq 1 ] && {
            mkdir -p /etc/mosdns/rule/adlist
            rm -rf /etc/mosdns/rule/adlist/*
            \cp $AD_TMPDIR/* /etc/mosdns/rule/adlist
        }
    fi
    rm -rf "$AD_TMPDIR" "$lock_file"
}

geodat_update() (
    TMPDIR=$(mktemp -d) || exit 1
    [ -n "$(uci -q get mosdns.config.github_proxy)" ] && mirror="$(uci -q get mosdns.config.github_proxy)/"
    # geoip.dat - cn-private
    geoip_type=$(uci -q get mosdns.config.geoip_type || echo "geoip-only-cn-private")
    echo -e "Downloading "$mirror"https://github.com/Loyalsoldier/geoip/releases/latest/download/"$geoip_type".dat"
    curl --connect-timeout 5 -m 120 --ipv4 -kfSLo "$TMPDIR/geoip.dat" ""$mirror"https://github.com/Loyalsoldier/geoip/releases/latest/download/"$geoip_type".dat"
    [ $? -ne 0 ] && rm -rf "$TMPDIR" && exit 1
    # checksum - geoip.dat
    echo -e "Downloading "$mirror"https://github.com/Loyalsoldier/geoip/releases/latest/download/"$geoip_type".dat.sha256sum"
    curl --connect-timeout 5 -m 20 --ipv4 -kfSLo "$TMPDIR/geoip.dat.sha256sum" ""$mirror"https://github.com/Loyalsoldier/geoip/releases/latest/download/"$geoip_type".dat.sha256sum"
    [ $? -ne 0 ] && rm -rf "$TMPDIR" && exit 1
    if [ "$(sha256sum "$TMPDIR/geoip.dat" | awk '{print $1}')" != "$(cat "$TMPDIR/geoip.dat.sha256sum" | awk '{print $1}')" ]; then
        echo -e "\e[1;31mgeoip.dat checksum error"
        rm -rf "$TMPDIR"
        exit 1
    fi

    # geosite.dat
    echo -e "Downloading "$mirror"https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat"
    curl --connect-timeout 5 -m 120 --ipv4 -kfSLo "$TMPDIR/geosite.dat" ""$mirror"https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat"
    [ $? -ne 0 ] && rm -rf "$TMPDIR" && exit 1
    # checksum - geosite.dat
    echo -e "Downloading "$mirror"https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat.sha256sum"
    curl --connect-timeout 5 -m 20 --ipv4 -kfSLo "$TMPDIR/geosite.dat.sha256sum" ""$mirror"https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat.sha256sum"
    [ $? -ne 0 ] && rm -rf "$TMPDIR" && exit 1
    if [ "$(sha256sum "$TMPDIR/geosite.dat" | awk '{print $1}')" != "$(cat "$TMPDIR/geosite.dat.sha256sum" | awk '{print $1}')" ]; then
        echo -e "\e[1;31mgeosite.dat checksum error"
        rm -rf "$TMPDIR"
        exit 1
    fi
    rm -rf "$TMPDIR"/*.sha256sum
    \cp -a "$TMPDIR"/* /usr/share/v2ray
    rm -rf "$TMPDIR"
)

restart_service() {
    /etc/init.d/mosdns restart
}

ui_event_log() {
    event="$2"
    page="$3"
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    logger -t luci-app-mosdns "ui_event:$event page:$page"
    echo "$ts ui_event:$event page:$page" >> /tmp/mosdns-ui.log
}

set_default_dns_group() {
    target="$1"
    [ -z "$target" ] && exit 1
    found=0
    for sec in $(uci -q show mosdns | awk -F '[.=]' '/=dns_group$/{print $2}'); do
        real_sec=$(uci -q show mosdns.$sec | awk -F '[.=]' 'NR==1{print $2}')
        [ -z "$real_sec" ] && real_sec="$sec"
        if [ "$sec" = "$target" ] || [ "$real_sec" = "$target" ]; then
            uci -q set mosdns.$real_sec.is_default='1'
            found=1
        else
            uci -q set mosdns.$real_sec.is_default='0'
        fi
    done
    [ "$found" -eq 1 ] || exit 1
    uci -q commit mosdns
}

restore_default_rule_files() {
    rm -rf /etc/mosdns/rule
    mkdir -p /etc/mosdns/rule

    if [ -d /rom/etc/mosdns/rule ]; then
        cp -a /rom/etc/mosdns/rule/. /etc/mosdns/rule/
    elif [ -d /usr/share/mosdns/rule ]; then
        cp -a /usr/share/mosdns/rule/. /etc/mosdns/rule/
    fi

    for f in whitelist.txt blocklist.txt greylist.txt ddnslist.txt hosts.txt redirect.txt local-ptr.txt cloudflare-cidr.txt; do
        [ -f /etc/mosdns/rule/$f ] || : > /etc/mosdns/rule/$f
    done

    : > /etc/mosdns/rule/ddnslist.txt
    : > /etc/mosdns/rule/greylist.txt
    : > /etc/mosdns/rule/whitelist.txt
    rm -rf /etc/mosdns/rule/adlist /etc/mosdns/rule/.ad_source
}

restore_rule_defaults() {
    local sec cn_id global_id rid

    while uci -q show mosdns | grep -q '=rule$'; do
        sec=$(uci -q show mosdns | awk -F '[.=]' '/=rule$/{print $2; exit}')
        [ -z "$sec" ] && break
        uci -q delete mosdns.$sec
    done
    while uci -q show mosdns | grep -q '=dns_group$'; do
        sec=$(uci -q show mosdns | awk -F '[.=]' '/=dns_group$/{print $2; exit}')
        [ -z "$sec" ] && break
        uci -q delete mosdns.$sec
    done
    while uci -q show mosdns | grep -q '=ip_map$'; do
        sec=$(uci -q show mosdns | awk -F '[.=]' '/=ip_map$/{print $2; exit}')
        [ -z "$sec" ] && break
        uci -q delete mosdns.$sec
    done

    uci -q set mosdns.config.schema_version='2'
    uci -q set mosdns.config.adblock='0'
    uci -q delete mosdns.config.ad_source
    uci -q add_list mosdns.config.ad_source='geosite.dat'
    restore_default_rule_files

    cn_id=$(uci -q add mosdns dns_group)
    uci -q set mosdns.$cn_id.name='国内'
    uci -q set mosdns.$cn_id.is_default='0'
    uci -q set mosdns.$cn_id.use_default_dns='0'
    uci -q add_list mosdns.$cn_id.dns='119.29.29.29'

    global_id=$(uci -q add mosdns dns_group)
    uci -q set mosdns.$global_id.name='国外'
    uci -q set mosdns.$global_id.is_default='1'
    uci -q set mosdns.$global_id.use_default_dns='0'
    uci -q add_list mosdns.$global_id.dns='tls://8.8.8.8'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='0'
    uci -q set mosdns.$rid.name='广告过滤'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='adblock'
    uci -q add_list mosdns.$rid.ad_source='geosite.dat'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='Hosts'
    uci -q set mosdns.$rid.mode='hosts'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/hosts.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='重定向'
    uci -q set mosdns.$rid.mode='redirect'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/redirect.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='PTR黑名单'
    uci -q set mosdns.$rid.mode='blacklist'
    uci -q set mosdns.$rid.blacklist_type='ptr'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/local-ptr.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='黑名单'
    uci -q set mosdns.$rid.mode='blacklist'
    uci -q set mosdns.$rid.blacklist_type='domain'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/blocklist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='DDNS域名'
    uci -q set mosdns.$rid.mode='custom'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='auto'
    uci -q set mosdns.$rid.ttl='5'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/ddnslist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='0'
    uci -q set mosdns.$rid.name='Apple 域名优化'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='apple_domain'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='auto'
    uci -q set mosdns.$rid.rule_file='/var/mosdns/geosite_apple.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='灰名单'
    uci -q set mosdns.$rid.mode='custom'
    uci -q set mosdns.$rid.dns_group="$global_id"
    uci -q set mosdns.$rid.ip_strategy='ipv4_first'
    uci -q set mosdns.$rid.ttl='0'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/greylist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='白名单'
    uci -q set mosdns.$rid.mode='custom'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='ipv4_first'
    uci -q set mosdns.$rid.ttl='0'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/whitelist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='国内域名'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='cn_domain'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='auto'
    uci -q set mosdns.$rid.rule_file='/var/mosdns/geosite_cn.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='国外域名'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='noncn_domain'
    uci -q set mosdns.$rid.dns_group="$global_id"
    uci -q set mosdns.$rid.ip_strategy='ipv4'
    uci -q set mosdns.$rid.rule_file='/var/mosdns/geosite_geolocation-!cn.txt'

    uci -q commit mosdns
}

restore_rule_defaults_keep_groups() {
    local sec cn_id global_id first_id default_id rid

    while uci -q show mosdns | grep -q '=rule$'; do
        sec=$(uci -q show mosdns | awk -F '[.=]' '/=rule$/{print $2; exit}')
        [ -z "$sec" ] && break
        uci -q delete mosdns.$sec
    done
    while uci -q show mosdns | grep -q '=ip_map$'; do
        sec=$(uci -q show mosdns | awk -F '[.=]' '/=ip_map$/{print $2; exit}')
        [ -z "$sec" ] && break
        uci -q delete mosdns.$sec
    done

    for sec in $(uci -q show mosdns | awk -F '[.=]' '/=dns_group$/{print $2}'); do
        [ -z "$first_id" ] && first_id="$sec"
        [ "$(uci -q get mosdns.$sec.is_default)" = "1" ] && [ -z "$default_id" ] && default_id="$sec"
        [ "$(uci -q get mosdns.$sec.name)" = '国内' ] && cn_id="$sec"
        [ "$(uci -q get mosdns.$sec.name)" = '国外' ] && global_id="$sec"
    done

    [ -z "$first_id" ] && exit 1
    [ -z "$default_id" ] && default_id="$first_id"
    [ -z "$cn_id" ] && cn_id="$first_id"
    [ -z "$global_id" ] && global_id="$default_id"

    uci -q set mosdns.config.schema_version='2'
    uci -q set mosdns.config.adblock='0'
    uci -q delete mosdns.config.ad_source
    uci -q add_list mosdns.config.ad_source='geosite.dat'
    restore_default_rule_files

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='0'
    uci -q set mosdns.$rid.name='广告过滤'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='adblock'
    uci -q add_list mosdns.$rid.ad_source='geosite.dat'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='Hosts'
    uci -q set mosdns.$rid.mode='hosts'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/hosts.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='重定向'
    uci -q set mosdns.$rid.mode='redirect'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/redirect.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='PTR黑名单'
    uci -q set mosdns.$rid.mode='blacklist'
    uci -q set mosdns.$rid.blacklist_type='ptr'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/local-ptr.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='黑名单'
    uci -q set mosdns.$rid.mode='blacklist'
    uci -q set mosdns.$rid.blacklist_type='domain'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/blocklist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='DDNS域名'
    uci -q set mosdns.$rid.mode='custom'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='auto'
    uci -q set mosdns.$rid.ttl='5'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/ddnslist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='0'
    uci -q set mosdns.$rid.name='Apple 域名优化'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='apple_domain'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='auto'
    uci -q set mosdns.$rid.rule_file='/var/mosdns/geosite_apple.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='灰名单'
    uci -q set mosdns.$rid.mode='custom'
    uci -q set mosdns.$rid.dns_group="$global_id"
    uci -q set mosdns.$rid.ip_strategy='ipv4_first'
    uci -q set mosdns.$rid.ttl='0'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/greylist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='白名单'
    uci -q set mosdns.$rid.mode='custom'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='ipv4_first'
    uci -q set mosdns.$rid.ttl='0'
    uci -q set mosdns.$rid.rule_file='/etc/mosdns/rule/whitelist.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='国内域名'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='cn_domain'
    uci -q set mosdns.$rid.dns_group="$cn_id"
    uci -q set mosdns.$rid.ip_strategy='auto'
    uci -q set mosdns.$rid.rule_file='/var/mosdns/geosite_cn.txt'

    rid=$(uci -q add mosdns rule)
    uci -q set mosdns.$rid.enabled='1'
    uci -q set mosdns.$rid.name='国外域名'
    uci -q set mosdns.$rid.mode='builtin'
    uci -q set mosdns.$rid.builtin_type='noncn_domain'
    uci -q set mosdns.$rid.dns_group="$global_id"
    uci -q set mosdns.$rid.ip_strategy='ipv4'
    uci -q set mosdns.$rid.rule_file='/var/mosdns/geosite_geolocation-!cn.txt'

    uci -q commit mosdns
}

flush_cache() {
    curl -s 127.0.0.1:$(uci -q get mosdns.config.listen_port_api)/plugins/lazy_cache/flush || exit 1
}

v2dat_dump() {
    # env
    v2dat_dir=/usr/share/v2ray
    adblock=$(uci -q get mosdns.config.adblock)
    ad_source=$(uci -q get mosdns.config.ad_source)
    configfile=$(uci -q get mosdns.config.configfile)
    mkdir -p /var/mosdns
    rm -f /var/mosdns/geo*.txt
    if [ "$configfile" = "/var/etc/mosdns.json" ]; then
        # default config
        v2dat unpack geoip -o /var/mosdns -f cn $v2dat_dir/geoip.dat
        v2dat unpack geosite -o /var/mosdns -f cn -f apple -f 'geolocation-!cn' $v2dat_dir/geosite.dat
        [ "$adblock" = 1 ] && [ $(echo $ad_source | grep -c geosite.dat) -ge '1' ] && v2dat unpack geosite -o /var/mosdns -f category-ads-all $v2dat_dir/geosite.dat
        v2dat unpack geosite -o /var/mosdns -f netflix -f disney -f hulu $v2dat_dir/geosite.dat || \
        touch /var/mosdns/geosite_disney.txt ; touch /var/mosdns/geosite_netflix.txt ; touch /var/mosdns/geosite_hulu.txt
    else
        # custom config
        v2dat unpack geoip -o /var/mosdns -f cn $v2dat_dir/geoip.dat
        v2dat unpack geosite -o /var/mosdns -f cn -f 'geolocation-!cn' $v2dat_dir/geosite.dat
        geoip_tags=$(uci -q get mosdns.config.geoip_tags)
        geosite_tags=$(uci -q get mosdns.config.geosite_tags)
        [ -n "$geoip_tags" ] && v2dat unpack geoip -o /var/mosdns $(echo $geoip_tags | sed -r 's/\S+/-f &/g') $v2dat_dir/geoip.dat
        [ -n "$geosite_tags" ] && v2dat unpack geosite -o /var/mosdns $(echo $geosite_tags | sed -r 's/\S+/-f &/g') $v2dat_dir/geosite.dat
    fi
}

case $script_action in
    "dns")
        interface_dns
    ;;
    "default_dns")
        default_interface_dns
    ;;
    "adlist")
        get_adlist
    ;;
    "geodata")
        geodat_update && adlist_update && restart_service
    ;;
    "logfile")
        logfile_path
    ;;
    "adlist_update")
        adlist_update && [ "$has_update" -eq 1 ] && restart_service
    ;;
    "flush")
        flush_cache
    ;;
    "set_default_dns_group")
        set_default_dns_group "$2"
    ;;
    "restore_rule_defaults")
        restore_rule_defaults
    ;;
    "restore_rule_defaults_keep_groups")
        restore_rule_defaults_keep_groups
    ;;
    "v2dat_dump")
        v2dat_dump
    ;;
    "printlog")
        print_logfile
    ;;
    "cleanlog")
        clean_logfile
    ;;
    "version")
        mosdns version
    ;;
    "ui_event")
        ui_event_log "$@"
    ;;
    *)
        exit 0
    ;;
esac

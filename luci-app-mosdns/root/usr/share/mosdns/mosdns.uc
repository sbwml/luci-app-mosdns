#!/usr/bin/env ucode

'use strict';

import { popen, mkdir, unlink, writefile, open, stat, stdout } from 'fs';
import { cursor } from 'uci';
import { connect } from 'ubus';

function to_array(val) {
	let res =[];
	if (type(val) == 'array') {
		for (let i = 0; i < length(val); i++) {
			if (type(val[i]) == 'string') {
				let s = replace(val[i], /^\s+|\s+$/g, '');
				if (s != "") push(res, s);
			}
		}
	} else if (type(val) == 'string') {
		let parts = split(val, /[ \t\n]+/);
		for (let i = 0; i < length(parts); i++) {
			if (parts[i] != "") push(res, parts[i]);
		}
	}
	return res;
}

function exec_sys(cmd) {
	let p = popen(cmd + " 2>&1", "r");
	if (!p) return { code: -1, stdout: "" };
	let stdout = p.read("all");
	let code = p.close();
	if (type(stdout) == 'string') {
		stdout = replace(stdout, /^\s+|\s+$/g, '');
	}
	return { code: code, stdout: stdout || "" };
}

function interface_dns() {
	let uci_cursor = cursor();
	uci_cursor.load('mosdns');
	let dns_list =[];

	if (uci_cursor.get('mosdns', 'config', 'custom_local_dns') === '1') {
		dns_list = to_array(uci_cursor.get('mosdns', 'config', 'local_dns'));
	} else {
		uci_cursor.load('network');
		let peerdns = uci_cursor.get('network', 'wan', 'peerdns');
		let proto = uci_cursor.get('network', 'wan', 'proto');

		if (peerdns === '0' || proto === 'static') {
			dns_list = to_array(uci_cursor.get('network', 'wan', 'dns'));
		} else {
			let ubus_conn = connect();
			if (ubus_conn) {
				let status = ubus_conn.call('network.interface.wan', 'status');
				if (status && type(status['dns-server']) == 'array' && length(status['dns-server']) > 0) {
					dns_list = status['dns-server'];
				}
			}
		}
	}

	if (length(dns_list) === 0) {
		dns_list =['119.29.29.29', '223.5.5.5'];
	}
	print(join(" ", dns_list) + "\n");
}

function get_adlist() {
	let uci_cursor = cursor();
	uci_cursor.load('mosdns');
	let adblock = uci_cursor.get('mosdns', 'config', 'adblock');

	if (adblock !== '1') {
		mkdir('/etc/mosdns/rule', 0755);
		exec_sys('rm -rf /etc/mosdns/rule/adlist /etc/mosdns/rule/.ad_source');
		writefile('/var/mosdns/disable-ads.txt', '');
		print("/var/mosdns/disable-ads.txt\n");
		return;
	}

	mkdir('/etc/mosdns/rule/adlist', 0755);
	let ad_source = to_array(uci_cursor.get('mosdns', 'config', 'ad_source'));
	let adlist =[];

	for (let i = 0; i < length(ad_source); i++) {
		let url = ad_source[i];
		if (!url) continue;

		if (url === 'geosite.dat') {
			push(adlist, '/var/mosdns/geosite_category-ads-all.txt');
		} else if (index(url, 'file://') === 0) {
			push(adlist, substr(url, 7));
		} else {
			let parts = split(url, '/');
			let filename = parts[length(parts) - 1];
			let local_path = `/etc/mosdns/rule/adlist/${filename}`;
			if (!stat(local_path)) {
				writefile(local_path, '');
			}
			push(adlist, local_path);
		}
	}
	print(join("\n", adlist) + "\n");
}

function update_adlist() {
	let uci_cursor = cursor();
	uci_cursor.load('mosdns');

	if (uci_cursor.get('mosdns', 'config', 'adblock') !== '1') {
		return false;
	}

	let lock_file = '/var/lock/mosdns_ad_update.lock';
	let ad_source = to_array(uci_cursor.get('mosdns', 'config', 'ad_source'));
	let github_proxy = uci_cursor.get('mosdns', 'config', 'github_proxy') || '';

	mkdir('/etc/mosdns/rule', 0755);
	writefile('/etc/mosdns/rule/.ad_source', '');

	if (stat(lock_file)) return false;
	writefile(lock_file, '');

	let tmp_res = exec_sys('mktemp -d');
	if (tmp_res.code !== 0) {
		unlink(lock_file);
		die("Failed to create temp directory for adlist.");
	}
	let ad_tmpdir = tmp_res.stdout;
	let has_update = false;
	let download_failed = false;

	for (let i = 0; i < length(ad_source); i++) {
		let url = ad_source[i];
		if (!url) continue;

		if (url !== 'geosite.dat' && index(url, 'file://') !== 0) {
			has_update = true;
			exec_sys(`echo "${url}" >> /etc/mosdns/rule/.ad_source`);

			let parts = split(url, '/');
			let filename = parts[length(parts) - 1];
			let mirror = "";

			if (match(url, /^https:\/\/raw\.githubusercontent\.com/)) {
				mirror = github_proxy ? github_proxy + '/' : '';
			}

			print(`Downloading ${mirror}${url}\n`);
			stdout.flush();
			let curl_res = exec_sys(`curl --connect-timeout 5 -m 90 --ipv4 -kfSLo "${ad_tmpdir}/${filename}" "${mirror}${url}"`);
			if (curl_res.code !== 0) download_failed = true;
		}
	}

	if (download_failed) {
		exec_sys(`rm -rf "${ad_tmpdir}"`);
		unlink(lock_file);
		die("Rules download failed.");
	} else {
		if (has_update) {
			mkdir('/etc/mosdns/rule/adlist', 0755);
			exec_sys('rm -rf /etc/mosdns/rule/adlist/*');
			exec_sys(`cp "${ad_tmpdir}"/* /etc/mosdns/rule/adlist/`);
		}
	}

	exec_sys(`rm -rf "${ad_tmpdir}"`);
	unlink(lock_file);

	return has_update;
}

function update_geodat() {
	let uci_cursor = cursor();
	uci_cursor.load('mosdns');

	let github_proxy = uci_cursor.get('mosdns', 'config', 'github_proxy') || '';
	let mirror = github_proxy ? github_proxy + '/' : '';
	let geoip_type = uci_cursor.get('mosdns', 'config', 'geoip_type') || 'geoip-only-cn-private';
	let v2dat_dir = '/usr/share/v2ray';

	let tmp_res = exec_sys('mktemp -d');
	if (tmp_res.code !== 0) die("Failed to create temp directory for geodata.");
	let tmpdir = tmp_res.stdout;

	exec_sys(`mkdir -p "${v2dat_dir}"`);

	let geoip_updated = false;
	let geoip_url = mirror + "https://github.com/Loyalsoldier/geoip/releases/latest/download/" + geoip_type + ".dat";

	print(`Downloading ${geoip_url}.sha256sum\n`);
	stdout.flush();
	if (exec_sys(`curl --connect-timeout 5 -m 20 --ipv4 -kfSLo "${tmpdir}/geoip.dat.sha256sum" "${geoip_url}.sha256sum"`).code !== 0) {
		exec_sys(`rm -rf "${tmpdir}"`);
		die("Failed to download geoip.dat.sha256sum");
	}

	let geoip_sum_remote = split(exec_sys(`cat "${tmpdir}/geoip.dat.sha256sum"`).stdout, /[ \t\n]+/)[0];
	let geoip_sum_local = "";
	if (stat(`${v2dat_dir}/geoip.dat`)) {
		geoip_sum_local = split(exec_sys(`sha256sum "${v2dat_dir}/geoip.dat"`).stdout, /[ \t\n]+/)[0];
	}

	if (geoip_sum_local === geoip_sum_remote) {
		print("geoip.dat is up to date.\n");
		stdout.flush();
	} else {
		print(`Downloading ${geoip_url}\n`);
		stdout.flush();
		if (exec_sys(`curl --connect-timeout 5 -m 120 --ipv4 -kfSLo "${tmpdir}/geoip.dat" "${geoip_url}"`).code !== 0) {
			exec_sys(`rm -rf "${tmpdir}"`);
			die("Failed to download geoip.dat");
		}

		let sum_downloaded = split(exec_sys(`sha256sum "${tmpdir}/geoip.dat"`).stdout, /[ \t\n]+/)[0];
		if (sum_downloaded !== geoip_sum_remote) {
			exec_sys(`rm -rf "${tmpdir}"`);
			die("geoip.dat checksum error");
		}
		geoip_updated = true;
	}

	let geosite_updated = false;
	let geosite_url = mirror + "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat";

	print(`Downloading ${geosite_url}.sha256sum\n`);
	stdout.flush();
	if (exec_sys(`curl --connect-timeout 5 -m 20 --ipv4 -kfSLo "${tmpdir}/geosite.dat.sha256sum" "${geosite_url}.sha256sum"`).code !== 0) {
		exec_sys(`rm -rf "${tmpdir}"`);
		die("Failed to download geosite.dat.sha256sum");
	}

	let geosite_sum_remote = split(exec_sys(`cat "${tmpdir}/geosite.dat.sha256sum"`).stdout, /[ \t\n]+/)[0];
	let geosite_sum_local = "";
	if (stat(`${v2dat_dir}/geosite.dat`)) {
		geosite_sum_local = split(exec_sys(`sha256sum "${v2dat_dir}/geosite.dat"`).stdout, /[ \t\n]+/)[0];
	}

	if (geosite_sum_local === geosite_sum_remote) {
		print("geosite.dat is up to date.\n");
		stdout.flush();
	} else {
		print(`Downloading ${geosite_url}\n`);
		stdout.flush();
		if (exec_sys(`curl --connect-timeout 5 -m 120 --ipv4 -kfSLo "${tmpdir}/geosite.dat" "${geosite_url}"`).code !== 0) {
			exec_sys(`rm -rf "${tmpdir}"`);
			die("Failed to download geosite.dat");
		}

		let sum_downloaded = split(exec_sys(`sha256sum "${tmpdir}/geosite.dat"`).stdout, /[ \t\n]+/)[0];
		if (sum_downloaded !== geosite_sum_remote) {
			exec_sys(`rm -rf "${tmpdir}"`);
			die("geosite.dat checksum error");
		}
		geosite_updated = true;
	}

	if (geoip_updated) {
		exec_sys(`cp -a "${tmpdir}/geoip.dat" "${v2dat_dir}/"`);
	}

	if (geosite_updated) {
		exec_sys(`cp -a "${tmpdir}/geosite.dat" "${v2dat_dir}/"`);
	}

	exec_sys(`rm -rf "${tmpdir}"`);
}

function v2dat_dump() {
	let uci_cursor = cursor();
	uci_cursor.load('mosdns');
	let v2dat_dir = '/usr/share/v2ray';
	let configfile = uci_cursor.get('mosdns', 'config', 'configfile') || '/var/etc/mosdns.json';
	let adblock = uci_cursor.get('mosdns', 'config', 'adblock');
	let ad_source = uci_cursor.get('mosdns', 'config', 'ad_source') || "";
	let streaming_media = uci_cursor.get('mosdns', 'config', 'custom_stream_media_dns');

	mkdir('/var/mosdns', 0755);
	exec_sys('rm -f /var/mosdns/geo*.txt');

	if (configfile === "/var/etc/mosdns.json") {
		exec_sys(`v2dat unpack geoip -o /var/mosdns -f cn ${v2dat_dir}/geoip.dat`);
		exec_sys(`v2dat unpack geosite -o /var/mosdns -f cn -f apple -f 'geolocation-!cn' ${v2dat_dir}/geosite.dat`);

		if (adblock === '1' && index(ad_source, 'geosite.dat') !== -1) {
			exec_sys(`v2dat unpack geosite -o /var/mosdns -f category-ads-all ${v2dat_dir}/geosite.dat`);
		}

		if (streaming_media === '1') {
			exec_sys(`v2dat unpack geosite -o /var/mosdns -f netflix -f disney -f hulu ${v2dat_dir}/geosite.dat`);
		} else {
			writefile('/var/mosdns/geosite_disney.txt', '');
			writefile('/var/mosdns/geosite_netflix.txt', '');
			writefile('/var/mosdns/geosite_hulu.txt', '');
		}
	} else {
		exec_sys(`v2dat unpack geoip -o /var/mosdns -f cn ${v2dat_dir}/geoip.dat`);
		exec_sys(`v2dat unpack geosite -o /var/mosdns -f cn -f 'geolocation-!cn' ${v2dat_dir}/geosite.dat`);

		let geoip_tags = to_array(uci_cursor.get('mosdns', 'config', 'geoip_tags'));
		if (length(geoip_tags) > 0) {
			let tags_str = "-f '" + join("' -f '", geoip_tags) + "'";
			exec_sys(`v2dat unpack geoip -o /var/mosdns ${tags_str} ${v2dat_dir}/geoip.dat`);
		}

		let geosite_tags = to_array(uci_cursor.get('mosdns', 'config', 'geosite_tags'));
		if (length(geosite_tags) > 0) {
			let tags_str = "-f '" + join("' -f '", geosite_tags) + "'";
			exec_sys(`v2dat unpack geosite -o /var/mosdns ${tags_str} ${v2dat_dir}/geosite.dat`);
		}
	}
}

let action = ARGV[0];

switch (action) {
	case "interface_dns":
		interface_dns();
		break;
	case "get_adlist":
		get_adlist();
		break;
	case "update":
		if (stat('/var/lock/mosdns_update.lock')) {
			print("Another update is already in progress.\n");
			exit(1);
		}
		writefile('/var/lock/mosdns_update.lock', '');
		try {
			update_geodat();
			update_adlist();
			v2dat_dump();
			print("UPDATE_FINISHED\n");
			stdout.flush();
		} catch (e) {
			print("Update failed: " + e + "\n");
			print("UPDATE_EXITED\n");
			stdout.flush();
			unlink('/var/lock/mosdns_update.lock');
			exit(1);
		}
		unlink('/var/lock/mosdns_update.lock');
		break;
	case "update_adlist":
		update_adlist();
		break;
	case "v2dat_dump":
		v2dat_dump();
		break;
	default:
		exit(0);
}

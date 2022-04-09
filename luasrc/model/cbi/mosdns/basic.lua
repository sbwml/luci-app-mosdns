m = Map("mosdns")
m.title = translate("MosDNS")
m.description = translate("MosDNS is a 'programmable' DNS forwarder.")

m:section(SimpleSection).template = "mosdns/mosdns_status"

s = m:section(TypedSection, "mosdns")
s.addremove = false
s.anonymous = true

enable = s:option(Flag, "enabled", translate("Enable"))
enable.rmempty = false

configfile = s:option(ListValue, "configfile", translate("MosDNS Config File"))
configfile:value("./def_config.yaml", translate("Def Config"))
configfile:value("./cus_config.yaml", translate("Cus Config"))
configfile.default = "./def_config.yaml"

loglv = s:option(ListValue, "loglv", translate("Log Level"))
loglv:value("debug")
loglv:value("info")
loglv:value("warn")
loglv:value("error")
loglv.default = "error"
loglv:depends( "configfile", "./def_config.yaml")

logfile = s:option(Value, "logfile", translate("MosDNS Log File"))
logfile.placeholder = "/dev/null"
logfile.default = "/dev/null"
logfile:depends( "configfile", "./def_config.yaml")

dnsforward = s:option(Value, "dns_forward", translate("Remote DNS"))
dnsforward.default = "tls://8.8.4.4"
dnsforward:value("tls://1.1.1.1", "1.1.1.1 (CloudFlare DNS)")
dnsforward:value("tls://8.8.8.8", "8.8.8.8 (Google DNS)")
dnsforward:value("tls://8.8.4.4", "8.8.4.4 (Google DNS)")
dnsforward:value("208.67.222.222", "208.67.222.222 (Open DNS)")
dnsforward:value("208.67.220.220", "208.67.220.220 (Open DNS)")
dnsforward:depends( "configfile", "./def_config.yaml")

cache_size = s:option(Value, "cache_size", translate("DNS Cache Size"))
cache_size.datatype = "and(uinteger,min(0))"
cache_size.rmempty = false

minimal_ttl = s:option(Value, "minimal_ttl", translate("Minimum TTL"))
minimal_ttl.datatype = "and(uinteger,min(1))"
minimal_ttl.datatype = "and(uinteger,max(3600))"
minimal_ttl.rmempty = false

maximum_ttl = s:option(Value, "maximum_ttl", translate("Maximum TTL"))
maximum_ttl.datatype = "and(uinteger,min(1))"
maximum_ttl.rmempty = false

redirect = s:option(Flag, "redirect", translate("Enable DNS Redirect"))
redirect:depends( "configfile", "./def_config.yaml")
redirect.default = true

adblock = s:option(Flag, "adblock", translate("Enable DNS ADblock"))
adblock:depends( "configfile", "./def_config.yaml")
adblock.default = true

config = s:option(TextValue, "manual-config")
config.description = translate("<font color=\"ff0000\"><strong>View the Custom YAML Configuration file used by this MosDNS. You can edit it as you own need.</strong></font>")
config.template = "cbi/tvalue"
config.rows = 25
config:depends( "configfile", "./cus_config.yaml")

function config.cfgvalue(self, section)
  return nixio.fs.readfile("/etc/mosdns/cus_config.yaml")
end

function config.write(self, section, value)
  value = value:gsub("\r\n?", "\n")
  nixio.fs.writefile("/etc/mosdns/cus_config.yaml", value)
end

return m

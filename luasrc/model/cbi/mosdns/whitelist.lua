m = Map("mosdns")
m.title = translate("MosDNS")
m.description = translate("MosDNS is a 'programmable' DNS forwarder.")

s = m:section(TypedSection, "mosdns")
s.addremove = false
s.anonymous = true

config = s:option(TextValue, "whitelist")
config.description = translate("<font color=\"ff0000\"><strong>ADblock whitelist.")
config.template = "cbi/tvalue"
config.rows = 25

function config.cfgvalue(self, section)
  return nixio.fs.readfile("/etc/mosdns/whitelist.txt")
end

function config.write(self, section, value)
  value = value:gsub("\r\n?", "\n")
  nixio.fs.writefile("/etc/mosdns/whitelist.txt", value)
end

return m

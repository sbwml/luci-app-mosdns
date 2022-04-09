m = Map("mosdns")

s = m:section(TypedSection, "mosdns", translate("ADblock whitelist"))
s.addremove = false
s.anonymous = true

config = s:option(TextValue, "whitelist")
config.description = translate("<font color=\"ff0000\"><strong>ADblock whitelist only apply to 'Def Config' profiles.</strong></font>")
config.template = "cbi/tvalue"
config.rows = 25

function config.cfgvalue(self, section)
  return nixio.fs.readfile("/etc/mosdns/whitelist.txt")
end

function config.write(self, section, value)
  value = value:gsub("\r\n?", "\n")
  nixio.fs.writefile("/etc/mosdns/whitelist.txt", value)
end

local apply = luci.http.formvalue("cbi.apply")
if apply then
  luci.sys.exec("/etc/init.d/mosdns reload")
end

return m

local datatypes = require "luci.cbi.datatypes"

local white_list_file = "/etc/mosdns/rule/whitelist.txt"
local block_list_file = "/etc/mosdns/rule/blocklist.txt"

m = Map("mosdns")

s = m:section(TypedSection, "mosdns", translate("Black and White List Settings"))
s.anonymous = true

s:tab("white_list", translate("White Lists"))
s:tab("block_list", translate("Block Lists"))

o = s:taboption("white_list", TextValue, "whitelist", "", "<font color='red'>" .. translate("These domain names allow DNS resolution with the highest priority. Please input the domain names of websites, every line can input only one website domain. For example: hm.baidu.com.") .. "</font>" .. "<font color='#00bd3e'>" .. translate("<br>The list of rules only apply to 'Default Config' profiles.") .. "</font>")
o.rows = 15
o.wrap = "off"
o.cfgvalue = function(self, section) return nixio.fs.readfile(white_list_file) or "" end
o.write = function(self, section, value) nixio.fs.writefile(white_list_file , value:gsub("\r\n", "\n")) end
o.remove = function(self, section, value) nixio.fs.writefile(white_list_file , "") end
o.validate = function(self, value)
    local hosts= {}
    string.gsub(value, '[^' .. "\r\n" .. ']+', function(w) table.insert(hosts, w) end)
    for index, host in ipairs(hosts) do
        if host:find("#") and host:find("#") == 1 then
            return value
        end
        if not datatypes.hostname(host) then
            return nil, host .. " " .. translate("Not valid domain name, Please Re-enter.")
        end
    end
    return value
end

o = s:taboption("block_list", TextValue, "blocklist", "", "<font color='red'>" .. translate("These domains are blocked from DNS resolution. Please input the domain names of websites, every line can input only one website domain. For example: baidu.com.") .. "</font>" .. "<font color='#00bd3e'>" .. translate("<br>The list of rules only apply to 'Default Config' profiles.") .. "</font>")
o.rows = 15
o.wrap = "off"
o.cfgvalue = function(self, section) return nixio.fs.readfile(block_list_file) or "" end
o.write = function(self, section, value) nixio.fs.writefile(block_list_file, value:gsub("\r\n", "\n")) end
o.remove = function(self, section, value) nixio.fs.writefile(block_list_file, "") end
o.validate = function(self, value)
    local hosts= {}
    string.gsub(value, '[^' .. "\r\n" .. ']+', function(w) table.insert(hosts, w) end)
    for index, host in ipairs(hosts) do
        if host:find("#") and host:find("#") == 1 then
            return value
        end
        if not datatypes.hostname(host) then
            return nil, host .. " " .. translate("Not valid domain name, Please Re-enter.")
        end
    end
    return value
end

local apply = luci.http.formvalue("cbi.apply")
if apply then
    luci.sys.exec("/etc/init.d/mosdns reload")
end

return m

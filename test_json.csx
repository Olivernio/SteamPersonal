using System;
using System.IO;
using System.Text.Json;

string targetPath = @\"C:\Users\Oliver\AppData\Roaming\GSE Saves\1446780\achievements.json\";
if (!File.Exists(targetPath)) {
    Console.WriteLine(\"Not found: \" + targetPath);
    return;
}

string json = File.ReadAllText(targetPath);
using var doc = JsonDocument.Parse(json);
var root = doc.RootElement;
foreach (var prop in root.EnumerateObject()) {
    Console.WriteLine($\"{prop.Name} -> {prop.Value.GetProperty(\"earned\").GetBoolean()}\");
}

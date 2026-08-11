async function test() {
  const r = await fetch('https://store.steampowered.com/app/582010');
  const html = await r.text();
  const dlcs = [...html.matchAll(/<a href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^>]+>[\s\S]*?<span class="name">([^<]+)<\/span>/g)].map(m => ({id: m[1], name: m[2].trim()}));
  console.log('Found', dlcs.length, 'dlcs directly in HTML.');
  console.log(dlcs.slice(0, 5));
}
test();

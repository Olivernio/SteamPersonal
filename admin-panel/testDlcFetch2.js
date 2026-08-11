async function test() {
  const r = await fetch('https://store.steampowered.com/app/582010');
  const html = await r.text();
  const dlcSection = html.substring(html.indexOf('game_area_dlc_section'));
  const match = [...dlcSection.matchAll(/<a href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^>]+>[\s\S]*?<div class="game_area_dlc_name">([^<]+)<\/div>/g)];
  console.log('Found', match.length, 'dlcs directly in HTML.');
  console.log(match.map(m => ({id: m[1], name: m[2].trim()})).slice(0, 5));
}
test();

async function test() {
  // 1. Get Game DLCs (Monster Hunter World = 582010)
  const r1 = await fetch('https://store.steampowered.com/api/appdetails?appids=582010');
  const d1 = await r1.json();
  const dlcIds = d1['582010'].data.dlc; // Array of numbers

  console.log(`Game has ${dlcIds.length} DLCs`);

  // 2. Get All Steam Apps
  console.log('Fetching all apps...');
  const r2 = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
  const d2 = await r2.json();
  const allApps = d2.applist.apps;

  console.log(`Fetched ${allApps.length} total apps from Steam`);

  // 3. Map DLC names
  const dlcSet = new Set(dlcIds);
  const gameDlcs = allApps.filter(app => dlcSet.has(app.appid));

  console.log(`Found ${gameDlcs.length} DLC names`);
  console.log(gameDlcs.slice(0, 5));
}
test();

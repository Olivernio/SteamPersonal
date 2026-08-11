import fs from 'fs';

const path = './src/components/CatalogManager.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Fix 1 & 2: duplicate ID and imageUrl
content = content.replace(
  "id: isNumeric ? appId : undefined,\n          id: uuidv4(),\n          name: dlcName || line",
  "id: uuidv4(),\n          name: dlcName || line"
);

// Fix unused `dlcs` in handleSave
content = content.replace(
  "const dlcs = dlcsList.filter((d) => d.name.trim() !== '');",
  ""
);

// Fix UI elements referencing image and description
// Since there's a map rendering inputs for dlcs:
// <input ... value={dlc.image} onChange={(e) => handleUpdateDlc(idx, 'image', e.target.value)} ... />
// We will just remove the whole inputs for image and description.
// It's probably a grid of 3 columns.
const imageInputRegex = /<input[^>]*value=\{dlc\.image\}[^>]*>/g;
content = content.replace(imageInputRegex, '{/* Removed image input */}');

const descInputRegex = /<input[^>]*value=\{dlc\.description\}[^>]*>/g;
content = content.replace(descInputRegex, '{/* Removed desc input */}');

// Let's also fix imageUrl unused
content = content.replace(
  "const imageUrl = isNumeric ? `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg` : '';",
  ""
);

// And we should remove `gridTemplateColumns: '2fr 2fr 3fr auto'` maybe, but it doesn't break TS.
// To be safe and just fix TS errors:
// We might have missed some `id` duplicate in `handleProcessBulkDlcs`
content = content.replace(
  /id: isNumeric \? appId : undefined,\s*id: uuidv4\(\),/g,
  "id: uuidv4(),"
);

fs.writeFileSync(path, content, 'utf-8');
console.log('Fixed TS errors');

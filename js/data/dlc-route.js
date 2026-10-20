// Shadow of the Erdtree route. Same shape as route.js. The DLC has no trophies or achievements,
// so steps complete goals instead: g = goal key from dlc-goals.js.
export const DLC_PHASES=[
{id:"d0",n:"Enter the Realm of Shadow",sub:"Before you step through",s:[
["tip","The DLC has no trophies or achievements. This route is a completion checklist for the DLC itself, and every step here is optional for the base game trophies."],
["boss","Defeat Starscourge Radahn at Redmane Castle in Caelid. He is fought during the festival and must be beaten before Mohg.",{g:"radahn"}],
["go","Reach Mohgwyn Palace. Use the sending gate in the West Consecrated Snowfield, or finish White Mask Varre's questline until you receive the Pureblood Knight's Medal and use it to travel there."],
["boss","Defeat Mohg, Lord of Blood.",{g:"mohg"}],
["quest","After Mohg, find the cocoon in the Mohgwyn Dynasty Mausoleum. Talk to Needle Knight Leda first, then touch the withered arm to enter the Land of Shadow.",{g:"enter"}],
["tip","Scadutree Fragments and Revered Spirit Ashes are applied at any grace through Shadow Realm Blessing. Their bonuses only work inside the Realm of Shadow. Check your Status screen: boosted stats show in yellow."],
["tip","Smithing Stones [1] to [9] and Shadow Realm Runes are scattered through the DLC. Pick up every glowing item, since fragments and ashes use the same rare-item glow."]]},
{id:"d1",n:"Gravesite Plain",sub:"Three-Path Cross and the first dungeons",s:[
["go","Head to the Three-Path Cross grace. The first Scadutree Fragment is near it, on the way to the first legacy dungeon."],
["item","Pick up the first Scadutree Fragment, then bless yourself at a grace once you hold enough."],
["tip","Optional fights on the plain: Church of Consolation (Black Knight elite), Scorched Ruins (Furnace Golem), Western Nameless Mausoleum (Blackgaol Knight) and the Ghostflame Dragon."],
["boss","Optional: Belurat Gaol, ending with Demi-Human Swordsman Onze."],
["tip","Dragon's Pit links the east of the plain to Jagged Peak. Leave it until after the Cerulean Coast."]]},
{id:"d2",n:"Belurat, Tower Settlement",sub:"Divine Beast Dancing Lion",s:[
["go","Travel to Belurat, Tower Settlement and fight your way to the Theatre of the Divine Beast."],
["warn","Fire Knight Queelign can invade here as an NPC. Fight or avoid him; he is optional."],
["boss","Defeat the Divine Beast Dancing Lion.",{g:"lion"}]]},
{id:"d3",n:"Castle Ensis",sub:"Rellana, Twin Moon Knight",s:[
["go","Cross Gravesite Plain to Castle Ensis and work up through the castle."],
["warn","Moonrithyll, Carian Knight can invade as an NPC. Hidden storerooms and rooftops hold extra items, so look around before the top."],
["boss","Defeat Rellana, Twin Moon Knight at the top of the castle.",{g:"rellana"}],
["go","Leave through the gate after Rellana to reach Scadu Altus."],
["tip","The castle route is skippable. A spiritspring jump near the Elder's Hovel leads to Behind the Fort of Reprimand, which also enters Scadu Altus."],
["boss","Optional nearby: Death Knight in Fog Rift Catacombs, Chief Bloodfiend in Rivermouth Cave, and the Ruined Forge Lava Intake (no boss)."]]},
{id:"d4",n:"Cerulean Coast",sub:"Putrescent Knight and Charo's Hidden Grave",s:[
["go","Travel to the Cerulean Coast. Look for the glowing items along the shore."],
["boss","Optional: Ghostflame Dragon in the coast basin, Demi-Human Queen Marrigga in the chasm, and the Dancer of Ranah in the island mausoleum."],
["boss","Defeat the Putrescent Knight in Stone Coffin Fissure.",{g:"putrescent"}],
["go","Go to Dragon's Pit and defeat the Ancient Dragon-Man. This opens the path to Charo's Hidden Grave and to Jagged Peak."],
["boss","Optional in Charo's Hidden Grave: Death Rite Bird in the arena and the Lamenter in Lamenter's Gaol."]]},
{id:"d5",n:"Scadu Altus",sub:"Highroad Cross, Fog Rift Fort and Rauh Base",s:[
["go","Start at Highroad Cross. The map fragment is on the map monument where the two roads meet."],
["map","Map Fragment: Scadu Altus. Take it at the map monument at the crossing."],
["boss","Optional: Black Knight Rolent in the Fort of Reprimand, the Ghostflame Dragon on the road to it, and Black Knight Garrew in Fog Rift Fort."],
["warn","Fire Knight Queelign invades at the Church of the Crusade. Defeating him drops the Crusade Insignia."],
["boss","Optional: Ralva, Great Red Bear by the lake east of the Furnace Golem."],
["boss","Optional duel: Dryleaf Dane at Moorth Ruins. Revisit after you reach Rauh Base.",{g:"dane"}],
["go","Visit Rauh Base. Nearby: Northern Nameless Mausoleum (Red Bear), Scorpion River Catacombs (Death Knight) and a Divine Beast Dancing Lion to the northwest of Temple Town Ruins."],
["boss","Optional: Curseblade Labirith in Bonny Gaol, south of Bonny Village."],
["tip","Revered Spirit Ash is found at Bonny Village. Furnace Golems here drop Crimsonburst, Bloodsucking, Oil-Soaked and Cerulean-Sapping tears."]]},
{id:"d6",n:"Shadow Keep",sub:"Messmer the Impaler",s:[
["go","From Highroad Cross take the road north to Shadow Keep Camp. Defeat the knights and soldiers, then enter the keep."],
["warn","Approaching the keep gate can break a great rune and change what NPCs say. Talk to NPCs again at Highroad Cross if their dialogue seems to stop."],
["go","Ride the elevator at the Main Gate grace to the top and work along the Shadow Keep main route."],
["boss","Defeat Messmer the Impaler. He drops the Remembrance of the Impaler and Messmer's Kindling, which you need to burn the Sealing Tree.",{g:"messmer"}],
["boss","Optional: the Ulcerated Tree Spirits in the Sunken District, and Commander Gaius at the end of the Scaduview route past two Tree Sentinels.",{g:"gaius"}],
["go","Optional lower route: defeat the Golden Hippo at the start of the keep, then reach Recluses' River, the Castle Watering Hole and Darklight Catacombs (Jorri, Elder Inquisitor)."]]},
{id:"d7",n:"Jagged Peak",sub:"Bayle the Dread",s:[
["go","Cross Dragon's Pit and climb to Jagged Peak. Expect drakes and an Ancient Dragon on the way."],
["boss","Defeat Bayle the Dread at the end of Jagged Peak. He does not appear until you go deep into the arena, and he drops the Heart of Bayle instead of a Remembrance.",{g:"bayle"}],
["tip","Igon's Furled Finger lets you summon Igon for the fight. Igon and Florissax give rewards after Bayle falls."]]},
{id:"d8",n:"Abyssal Woods",sub:"Midra, Lord of Frenzied Flame",s:[
["go","Go to the Abyssal Woods, east of Gravesite Plain at the bottom of a ravine. The Hornsent forbid this region."],
["boss","Optional mini-boss: Salza, Fire Knight Sage at the end of the large bridge."],
["boss","Defeat Midra, Lord of Frenzied Flame in Midra's Manse. He drops the Remembrance of the Lord of Frenzied Flame.",{g:"midra"}]]},
{id:"d9",n:"Finger Ruins",sub:"Manus Metyr questline",s:[
["quest","Follow the Manus Metyr questline through the Finger Ruins to the third ruin."],
["boss","Defeat Metyr, Mother of Fingers at the third Finger Ruins.",{g:"metyr"}],
["boss","Optional: defeat Ymir, Mother of Fingers in the Cathedral of Manus Metyr after Metyr."]]},
{id:"d10",n:"Ancient Ruins of Rauh",sub:"Romina and the Church of the Bud",s:[
["go","Travel to the Ancient Ruins of Rauh. An optional waygate from Highroad Cross also reaches it."],
["boss","Optional: Devonia, Crucible Knight at the lake."],
["boss","Defeat Romina, Saint of the Bud. This opens the Sealing Tree south of the Church of the Bud.",{g:"romina"}]]},
{id:"d11",n:"Enir-Ilim",sub:"Burn the Sealing Tree and finish the story",s:[
["warn","Back up your save before the finale. Open the Guide tab for how. Finish any NPC steps you care about first, since this is the end of the main quest."],
["quest","With Messmer's Kindling in hand and Romina defeated, burn the Sealing Tree south of the Church of the Bud. You are taken to Enir-Ilim's outer wall.",{g:"tree"}],
["tip","You can also enter Enir-Ilim from Belurat, where the path opens after the tree burns. An elevator connects the two."],
["go","Pass the Outer Wall, First Rise and Spiral Rise, then reach the Cleansing Chamber Anteroom grace."],
["boss","Fight Needle Knight Leda and her allies, then the arena encounter."],
["boss","Climb above the clouds and defeat Promised Consort Radahn.",{g:"finale"}]]},
];

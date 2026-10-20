// Shadow of the Erdtree route. Same shape as route.js. The DLC has no trophies or achievements,
// so steps complete goals instead: g = goal key from dlc-goals.js.
export const DLC_PHASES=[
{id:"d0",n:"Enter the Realm of Shadow",sub:"Before you step through",s:[
["tip","The DLC has no trophies or achievements. This route is a completion checklist for the DLC itself, and every step here is optional for the base game trophies."],
["boss","Defeat Starscourge Radahn in Caelid. Together with Mohg, he must be dead before the DLC opens. Already beaten him in the main route? Tick this too, since the DLC route tracks it separately.",{g:"radahn"}],
["go","Reach Mohgwyn Palace. Use the sending gate in the West Consecrated Snowfield, or finish White Mask Varre's questline until you receive the Pureblood Knight's Medal and use it to travel there."],
["boss","Defeat Mohg, Lord of Blood. Already beaten him in the main route? Tick this too.",{g:"mohg"}],
["quest","After Mohg, find the cocoon in the Mohgwyn Dynasty Mausoleum. Talk to Needle Knight Leda first, then touch the withered arm to enter the Land of Shadow.",{g:"enter"}],
["tip","Scadutree Fragments and Revered Spirit Ashes are applied at any grace through the blessing menus. Their bonuses only work inside the Realm of Shadow."],
["tip","Scadutree Fragments (50) and Revered Spirit Ashes (25) are the DLC's upgrade items. The blessing counters in this app track them."]]},
{id:"d1",n:"Gravesite Plain",sub:"Three-Path Cross and the first dungeons",s:[
["go","Head to the Three-Path Cross grace on the Gravesite Plain."],
["item","Collect Scadutree Fragments as you find them, then raise the blessing at a grace."],
["tip","The plain has several optional bosses, including the Blackgaol Knight, a Furnace Golem, a Red Bear and the Ghostflame Dragon."],
["boss","Optional: Belurat Gaol, ending with Demi-Human Swordmaster Onze."],
["tip","Dragon's Pit is a cave on the plain, southeast of the Castle Front grace. Beating its boss opens the way to Jagged Peak."]]},
{id:"d2",n:"Belurat, Tower Settlement",sub:"Divine Beast Dancing Lion",s:[
["go","Travel to Belurat, Tower Settlement and fight your way to the Theatre of the Divine Beast."],
["boss","Defeat the Divine Beast Dancing Lion.",{g:"lion"}]]},
{id:"d3",n:"Castle Ensis",sub:"Rellana, Twin Moon Knight",s:[
["go","Cross Gravesite Plain to Castle Ensis and work up through the castle."],
["boss","Defeat Rellana, Twin Moon Knight at the top of the castle.",{g:"rellana"}],
["go","Defeating Rellana opens the path to Highroad Cross in Scadu Altus."],
["tip","The castle can be skipped: a spiritspring jump leads to the Fort of Reprimand in Scadu Altus."]]},
{id:"d4",n:"Cerulean Coast",sub:"Putrescent Knight and Charo's Hidden Grave",s:[
["go","Travel to the Cerulean Coast. Look for the glowing items along the shore."],
["boss","Optional bosses on the coast: Demi-Human Queen Marigga, the Ghostflame Dragon and the Dancer of Ranah."],
["boss","Defeat the Putrescent Knight in Stone Coffin Fissure.",{g:"putrescent"}],
["go","In Dragon's Pit on the Gravesite Plain, defeat the Ancient Dragon-Man. The door behind him leads on to Jagged Peak, and the way to Charo's Hidden Grave starts from the Terminus grace."],
["boss","Optional in Charo's Hidden Grave: Death Rite Bird and a Tibia Mariner."]]},
{id:"d5",n:"Scadu Altus",sub:"Highroad Cross, Fog Rift Fort and Rauh Base",s:[
["go","Start at Highroad Cross. The map fragment is on the map monument where the two roads meet."],
["map","Map Fragment: Scadu Altus. Tick this when you have found it."],
["boss","Optional bosses in Scadu Altus include Black Knight Garrew, the Ghostflame Dragon, Ralva the Great Red Bear, Curseblade Labirith, a Death Knight and a Rakshasa."],
["boss","Optional duel: Dryleaf Dane at Moorth Ruins.",{g:"dane"}],
["tip","Revered Spirit Ash is found at Bonny Village, reached through Moorth Ruins. The ash sits north of the ravine under the first broken bridge."]]},
{id:"d6",n:"Shadow Keep",sub:"Messmer the Impaler",s:[
["go","Reach the Shadow Keep Main Gate grace: follow the path from Castle Ensis to the main entrance and take the lift. The Church District is a second way in, from the Church District High Road grace."],
["boss","Defeat Messmer the Impaler in the Specimen Storehouse, behind a door near the Dark Chamber Entrance grace. He drops the Remembrance of the Impaler and Messmer's Kindling, which you need to burn the Sealing Tree.",{g:"messmer"}],
["boss","Optional: Commander Gaius, north-northeast of the Storehouse Loft grace.",{g:"gaius"}],
["boss","Optional: the Golden Hippopotamus in the Main Plaza and the Lesser Ulcerated Tree Spirits in the Sunken Chapel. Fire Knight Queelign appears as an NPC invader at the Church of the Crusade."]]},
{id:"d7",n:"Jagged Peak",sub:"Bayle the Dread",s:[
["go","Beat the Ancient Dragon-Man in Dragon's Pit, then pass the Terminus grace into Jagged Peak, where drakes roam."],
["boss","Defeat Bayle the Dread at the end of Jagged Peak. He is in the crater above the Jagged Peak Summit grace and drops the Heart of Bayle.",{g:"bayle"}],
["tip","Igon's Furled Finger lets you summon Igon for the fight. Igon's Furled Finger comes from his questline."]]},
{id:"d8",n:"Abyssal Woods",sub:"Midra, Lord of Frenzied Flame",s:[
["go","Go to the Abyssal Woods."],
["boss","Defeat Midra, Lord of Frenzied Flame in Midra's Manse. He drops the Remembrance of the Lord of Frenzied Flame.",{g:"midra"}]]},
{id:"d9",n:"Finger Ruins",sub:"Manus Metyr questline",s:[
["quest","Follow Count Ymir's questline in the Cathedral of Manus Metyr in eastern Scadu Altus. It sends you to the Finger Ruins of Rhia on the Cerulean Coast and the Finger Ruins of Dheo. After the last bell, use the throne in the cathedral to descend."],
["boss","Defeat Metyr, Mother of Fingers in the Finger Ruins of Miyr beneath the cathedral.",{g:"metyr"}],]},
{id:"d10",n:"Ancient Ruins of Rauh",sub:"Romina and the Church of the Bud",s:[
["go","Travel to the Ancient Ruins of Rauh and the Church of the Bud."],
["boss","Defeat Romina, Saint of the Bud. This opens the Sealing Tree south of the Church of the Bud.",{g:"romina"}]]},
{id:"d11",n:"Enir-Ilim",sub:"Burn the Sealing Tree and finish the story",s:[
["warn","Back up your save before the finale. Open the Guide tab for how. Finish any NPC steps you care about first, since this is the end of the main quest."],
["quest","With Messmer's Kindling in hand and Romina defeated, burn the Sealing Tree south of the Church of the Bud. You are taken to Enir-Ilim's outer wall.",{g:"tree"}],
["tip","Burning the tree also opens the shadow-blocked entrance in Belurat, reached by the elevator east of the Stagefront grace. Burning it locks you out of finishing NPC questlines, so wrap those up first."],
["go","Climb through the tower from the Outer Wall. The First Rise is the first grace."],
["boss","Fight Needle Knight Leda and her allies, then the arena encounter."],
["boss","Climb above the clouds and defeat Promised Consort Radahn.",{g:"finale"}]]},
];

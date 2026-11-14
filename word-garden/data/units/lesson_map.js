/* lesson_map.js — 外研版（2024新版）初中英语课本「Unit → 课时」划分
 *
 * 每个 Unit 按课本真实课时切成 4 课：
 *   课时1 Starting out & Understanding ideas (Reading)
 *   课时2 Understanding ideas (Grammar)
 *   课时3 Developing ideas (Listening & Speaking)
 *   课时4 Developing ideas (Reading for Writing)
 *
 * 数据结构：{ deck: { 'unitId': [ [课时词...], [课时词...], ... ] } }
 * 词来自既有词库（data/words/*.txt），不新增、不丢失。
 */
window.LESSON_MAP = {

// ============ 七年级上册 ============
qishang: {
  starter: [
    ['ready','textbook','eraser','junior','geography','biology','history','grey'],
    ['jacket','scarf','uniform','forget','building','together','lab','start'],
    ['everyone','explore','fun','introduce','yourself'],
    ['hobby','nervous','join','team']
  ],
  u1: [
    ['without','sentence','point','mistake','polite','mind','dry','meaning','fact'],
    ['need','remember','really','important','plan','problem','homework'],
    ['task','project','advice','journey','something','thought'],
    ['life','pool','protect','wind','wide','sail','through','storm','hope']
  ],
  u2: [
    ['electric','guitar','band','sound','different','suddenly','hit','rush'],
    ['festival','decide','practice','stage','nod','instrument','everybody','smile','enjoy'],
    ['skate','club','volleyball','traditional','hold','ground','weak','high','nature'],
    ['notebook','awake','midnight','appear','heart','almost','tap','shake','classmate','lonely','magic','joy','shelf','leave','page','ending']
  ],
  u3: [
    ['silent','along','mountain','road','handsome','strict','follow','postman','touching','son'],
    ['serve','area','absent','seldom','position','carry','across','memory','tear'],
    ['growth','hide','care','hug','kiss','marry','queen','pick','actress'],
    ['change','race','serious','disease','stay','trailer','pull','bright','refuse','result','matter','power']
  ],
  u4: [
    ['unusual','university','treat','realise','dumpling','whole','cucumber','hang','balloon','lantern'],
    ['dish','joke','shocked','laugh','pork','round','shape','reunion','piece','knife','smell'],
    ['fill','Christmas','waste','pollution','plastic','celebrate','meal','duty','shine'],
    ['usually','break','emergency','miss','thirsty','challenge','patient','situation','regret','decision','support','medical','firework']
  ],
  u5: [
    ['within','quarter','workshop','leaf','each','collect','root','send','rise','stem'],
    ['mix','produce','sugar','product','oxygen','human','though','breathe','soon','dark','rest'],
    ['natural','seed','grow','part','rainforest','culture','corn silk','health','rose','cotton','bamboo'],
    ['popular','key','news','prefer','coffee','secret','husband','adult','weekend','chat','relax','yard','biscuit','connect']
  ],
  u6: [
    ['penguin','pigeon','surprise','knock','droppings','boring','feed','madly','scary','research'],
    ['recognise','themselves','mirror','itself','maybe','several','kilometre','lost','speed','amazing'],
    ['enough','beaver','wolf','engineer','hero','earthquake','missing','save','dead'],
    ['character','museum','island','ocean','plenty','friendly','peaceful','arrive','forest','hunt','die','full','fantastic']
  ]
},

// ============ 七年级下册 ============
qixia: {
  u1: [
    ['chocolate','factory','exciting','magical','town','poor','watery','cabbage','freezing','become'],
    ['touch','sunless','reason','everything','rich','chess','bath','basket','princess','example','experience'],
    ['believe','survey','instruction','empty','happen','presentation','hat','blow','wave','voice','himself'],
    ['shame','finally','barber','fall','shoulder','customer','surprised','scissors','office','receive','cancer','wig','smart']
  ],
  u2: [
    ['marathon','line','breath','confident','stomachache','shall','either','choice','neither','cheer','cross'],
    ['lifelong','dream','record','none','finish','encourage','both','sink','surfer','shark','attack'],
    ['lose','surfing','compare','surfboard','gold','medal','success','fit','final','match'],
    ['attention','continue','fight','score','goal','victory','chance','wonder','courage','spirit']
  ],
  u3: [
    ['delicious','taste','beef','carrot','mutton','fat','hen','pot','onion','pancake','porridge','plain'],
    ['menu','medicine','pill','remain','sandwich','pie','pepper','slice','beat','salt','oil','pan'],
    ['mixture','stir','plate','firm','recipe','ingredient','diet','salad','hamburger','snack','chip'],
    ['dangerous','border','Western','dessert','dynasty','store','folk','tale','emperor','stomach','Iranian','flat','twin','bridge']
  ],
  u4: [
    ['dull','imagine','alone','might','tool','list','choose','novel','magazine','solar','media'],
    ['bored','feeling','lift','funny','moment','youthful','invite','number','able','daily','housework'],
    ['unforgettable','insect','large','mosquito','set','interest','butterfly','prince','monster','notice'],
    ['form','social','screen','couch','sore','neck','deaf','balanced','jog','fresh','tennis','hike','ours']
  ],
  u5: [
    ['plateau','most','cloud','soft','brightly','sky','calm','above','express','grassland','field'],
    ['than','few','restaurant','present','better','proud','diary','describe','tide','metre','exhibition'],
    ['lungfish','lung','scientist','develop','land','aloud','die','salty','lie','surface','flow'],
    ['level','less','suggest','snake','only','however','wood','disappear','if','glacier','climate']
  ],
  u6: [
    ['airport','burn','expect','deep','lemon','reply','mouthful','surprisingly','mask','normal','ancient'],
    ['further','trip','general','curious','local','hotel','comfortable','other','waterfall','powerful','thunder'],
    ['painting','huge','myself','ant','beauty','accept','award','understand','traffic','seriously'],
    ['end','spend','achieve','discovery','peak','truth','climb','discover','view','description']
  ]
},

// ============ 八年级上册 ============
bashang: {
  u1: [
    ['suppose','birthmark','strawberry','away','crowded','just','disaster','therefore','cover','until','instead'],
    ['although','bathroom','truly','paint','own','yet','anyway','already','special','difference','hate'],
    ['opinion','row','thing','height','friendship','among','wizard','brain','value','quality'],
    ['ourselves','impossible','possible','nothing','British','silver','doubt','fear','succeed'],
    ['excellent','ever','second','satisfied','risky','zero','such','Olympics','athlete','youngster','stick','superman']
  ],
  u2: [
    ['selfish','giant','shout','gate','build','since','nor','hole','glad','knock','afraid','double'],
    ['similar','message','action','climax','return','lively','theirs','grade','priceless','past','offer'],
    ['quite','stressed','recently','online','discuss','ticket','guess','suggestion','explain','true','respect'],
    ['narrow','lane','common','unit','perhaps','argue','divide','reach','agreement','relative','government'],
    ['poem','inside','neighbour','drift','ashamed','step','act','same','another','pass','whenever']
  ],
  u3: [
    ['fair','block','artificial','hook','cost','condition','lend','improve','printer','invent','signal'],
    ['weigh','kilogram','fix','invention','download','allow','solve','blind','machine','warn','object'],
    ['sense','congratulations','everyday','trouble','creative','imaginative','inventor','am','pm','glue'],
    ['fail','curiosity','once','talent','passionately','drive','detector','achievement','role'],
    ['development','electricity','during','more','lightning','pioneer','exploration','test','later','generation']
  ],
  u4: [
    ['digital','shock','century','ride','forever','pound','quickly','pay','smartphone','shopkeeper','wallet'],
    ['payment','system','cash','as','order','app','delivery','heat','oven','except','technology'],
    ['convenient','mobile','education','anytime','anywhere','check','via','course','teach','even'],
    ['progress','activity','offline','advantage','effect','charge','real','strange'],
    ['still','million','would','anyone','person','bedroom','neighbourhood']
  ],
  u5: [
    ['rule','opposite','packet','picnic','smelly','cheese','noise','reduce','kick','seat','passenger'],
    ['anything','fool','sign','clear','throat','responsibility','behaviour','belt','station','flowerpot'],
    ['mess','note','honesty','spread','society','lawyer','cause','accident','urgent','nowadays','citizen'],
    ['click','risk','basic','personal','private','avoid','address','passport','limit','password'],
    ['account','careless','aware','stranger','cheat','trust','enemy','behave','cyberbullying']
  ],
  u6: [
    ['lost','into','outside','scared','shut','shocking','coach','straight','ahead','sand'],
    ['while','flood','thick','smoke','ash','shower','around','daylight','erupt','volcano'],
    ['volcanic','eruption','reaction','hurricane','airline','weekday','railway','rainstorm'],
    ['service','search','report','orchestra','terrible','introduction','video','tsunami','iron']
  ]
},

// ============ 八年级下册 ============
baxia: {
  u1: [
    ['spiderman','wet','drop','sweat','watermelon','remind','newborn','brush','speech'],
    ['challenging','context','company','interview','communication','skill','personality','require'],
    ['organise','leadership','career','cashier','necessary','replace','pilot','autopilot'],
    ['tourism','surely','provide','low','beyond','virtual','reality','fashionable','market']
  ],
  u2: [
    ['promise','tonight','interrupt','lamp','blouse','pale','attach','wrist','policewoman'],
    ['elderly','plot','point','lazy','sofa','term','spend','conversation'],
    ['disagreement','attitude','childhood','peer','pressure','disappointed','fail','heartbreaking'],
    ['skiing','completely','upon','clearly']
  ],
  u3: [
    ['director','drama','leader','role','freeze','silence','awful','advise','yours'],
    ['teamwork','strength','weakness','vote','suggestion','meeting','captain','shy'],
    ['confidence','tent','camp','break','tape','voluntary','cooperation','noon'],
    ['climber','roof','ladder','teammate','lower','painful','rope','effort','north','base','mountaineering']
  ],
  u4: [
    ['excuse','purple','crayon','sunshine','virus','afford','disappointment','treatment'],
    ['pocket','illness','wheelchair','public','mention','directly','solution','bottle'],
    ['exam','dialogue','flu','homeless','donate','goodwill','soldier','fireman'],
    ['against','graduate','college','warmth','means','lucky']
  ],
  u5: [
    ['dinosaur','feather','lizard','amber','whether','northern','species','unknown','African'],
    ['belief','fully','unlock','newspaper','writing','style','method','text','alive'],
    ['argument','board','model','planet','upload','clear','whale','boiling','chemical'],
    ['endless','sight','anybody','magnifier','wealth','hardly','belong','granddaughter']
  ],
  u6: [
    ['sweetly','villager','wheat','countryside','province','react','especially','wisdom','below'],
    ['arrival','calendar','energetic','beekeeping','desert','energy','environment','resource'],
    ['probably','west','east','midsummer','crazy','rainfall','survive','underground'],
    ['canal','shortage','increase']
  ]
},

// ============ 九年级上册 ============
jiushang: {
  u1: [
    ['lady','gentleman','puppet','performer','finger','teenager','old-fashioned','performance','unless'],
    ['video','amaze','post','blood','interested','surprising','lost','viewer','attention'],
    ['abroad','teenage','programme','volunteer','group','report','fence','kill','scarecrow'],
    ['educator','country','nation','energy','youth','wealthy','independent','excerpt']
  ],
  u2: [
    ['tin','spare','moneybox','own','size','better','dreamland','manage','key','deal'],
    ['laptop','budget','exactly','pleasure','end','save','bank','account','expensive'],
    ['price','savings','date','sale','website','worth','dollar','cent','penny'],
    ['couple','flat','treasure','certainly','chain','comb']
  ],
  u3: [
    ['guest','remains','lie','northwest','such','archaeologist','giant','centre','period','form'],
    ['valuable','smoothly','luck','cartoon','silk','matchbox','weight','around','ton'],
    ['mystery','coast','pretty','hit','besides','creativity','technology','multimedia','noisy'],
    ['collection','fever','pride','design','bat','scarf','fridge','mirror']
  ],
  u4: [
    ['great-aunt','person','fighter','later','footstep','realise','could','gentle','pity'],
    ['war','battle','shock','survivor','temperature','lose','deeply','presenter'],
    ['recommend','co-pilot','engine','state','dreamer','pick','countless','thing','experiment'],
    ['type','poor','soil','feed','socialist']
  ],
  u5: [
    ['human','drop','tourist','benefit','wonder','admire','throughout','mark','rapid','society'],
    ['cancel','permit','affect','organisation','harm','punish','rubbish','overfish','gas'],
    ['square','logging','microphone','alarm','guard','foreigner','logo','endangered'],
    ['vulnerable','protection','farmland']
  ],
  u6: [
    ['consider','material','shape','long-lasting','cheap','environmental','toothbrush','glove','former'],
    ['wing','tie','stuck','bin','average','gram','tiny','trouble','wisely'],
    ['highlight','pollute','electronic','truck','emission','upcycle','reuse']
  ],
  u7: [
    ['fox','loudly','land','village','reporter','depth','suggest','businessman'],
    ['industrial','litter','peace','business','building','imagination']
  ]
},

// ============ 九年级下册（Module 制，本已较细，按课文切2课） ============
jiuxia: {
  m1: [ ['flight','direct','pilot','succeed'], ['exactly','sir','officer','stupid','jacket'] ],
  m2: [ ['ours','tie','row','pool'], ['pass','secondary','absent','bell'] ],
  m3: [ ['wealthy','fear','wealth','double','seldom','spare','deaf','tiny'], ['electric','light','candle','postman','cold','heat','full-time','role','education','transport'] ],
  m4: [ ['sock','whenever','proper','edge','yourself','starve','go','rock','stone'], ['fairly','smooth','straight','tent','fall','sudden','gun','soft','still','wood','blood'] ],
  m5: [ ['blind','ouch','expect','require'], ['physical','effort','harm','agreement'] ],
  m6: [ ['invitation','calendar','balloon','paint','knife','fork','spoon'], ['cheeseburger','Italian','westerner','west','serve','similar','wing','lady','gentleman','cross'] ],
  m7: [ ['achieve','including','speaker','boss','secretary','quarter'], ['industry','zero','Indian','type'] ],
  m8: [ ['handbag','beat','pardon','intend','fetch','pancake','rose'], ['kindness','disappointed','bedside','note','whom'] ]
}

};

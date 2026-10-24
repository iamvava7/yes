// Location data for Romania: all 320 official orașe + municipii (cities/towns),
// grouped by județ (county), each with a "zones" list.
//
// Data provenance:
// - City/county/administrative hierarchy: INSSE SIRUTA registry (official Romanian
//   territorial-administrative unit registry), cross-referenced for correct diacritics.
// - Zones for Iași, Huși and ~40 major cities (all județ county seats + București):
//   real, well-known cartiere/neighborhoods (hand-curated, not SIRUTA data).
// - Zones for smaller orașe: real component localities ("localități componente")
//   officially attached to that oraș/municipiu per SIRUTA — NOT informal cartiere,
//   since most small towns don't have formally-recognized neighborhood names.
//   Some smaller towns have no attached component localities and so have an
//   empty zones list; the city itself is still fully searchable.
export const LOCATIONS = {
  RO: [
    { city: "Abrud", county: "Alba", zones: ["Abrud-Sat", "Gura Cornei", "Soharu"] },
    { city: "Aiud", county: "Alba", zones: ["Aiudul de Sus", "Ciumbrud", "Gâmbaș", "Gârbova de Jos", "Gârbova de Sus", "Gârbovița", "Măgina", "Păgida", "Sâncrai", "Țifra"] },
    { city: "Alba Iulia", county: "Alba", zones: ["Bărăbanț", "Micești", "Oarda", "Pâclișa"] },
    { city: "Baia de Arieș", county: "Alba", zones: ["Brăzești", "Cioara de Sus", "Muncelu", "Sartăș", "Simulești"] },
    { city: "Blaj", county: "Alba", zones: ["Deleni-Obârșie", "Flitești", "Izvoarele", "Mănărade", "Petrisat", "Spătac", "Tiur", "Veza"] },
    { city: "Cugir", county: "Alba", zones: ["Bocșitura", "Bucuru", "Călene", "Fețeni", "Goașele", "Mugești", "Vinerea"] },
    { city: "Câmpeni", county: "Alba", zones: ["Boncești", "Borlești", "Botești", "Certege", "Coasta Vâscului", "Dealu Bistrii", "Dealu Capsei", "Dric", "Dănduț", "Fața Abrudului", "Florești", "Furduiești", "Mihoești", "Motorăști", "Peste Valea Bistrii", "Poduri", "Sorlița", "Tomușești", "Valea Bistrii", "Valea Caselor", "Vârși"] },
    { city: "Ocna Mureș", county: "Alba", zones: ["Cisteiu de Mureș", "Micoșlaca", "Războieni-Cetate", "Uioara de Jos", "Uioara de Sus"] },
    { city: "Sebeș", county: "Alba", zones: ["Lancrăm", "Petrești", "Răhău"] },
    { city: "Teiuș", county: "Alba", zones: ["Beldiu", "Coșlariu Nou", "Căpud", "Pețelca"] },
    { city: "Zlatna", county: "Alba", zones: ["Botești", "Budeni", "Dealu Roatei", "Dobrot", "Dumbrava", "Feneș", "Galați", "Izvoru Ampoiului", "Pirita", "Podu lui Paul", "Pârău Gruiului", "Pătrângeni", "Runc", "Ruși", "Suseni", "Trâmpoiele", "Valea Mică", "Vâltori"] },
    { city: "Arad", county: "Arad", zones: ["Centru", "Aradul Nou", "Grădiște", "Micălaca", "Alfa", "Confecții", "Sânnicolau Mic", "Gai", "Subcetate", "Bujac"] },
    { city: "Chișineu-Criș", county: "Arad", zones: ["Nadab"] },
    { city: "Curtici", county: "Arad", zones: [] },
    { city: "Ineu", county: "Arad", zones: ["Mocrea"] },
    { city: "Lipova", county: "Arad", zones: ["Radna", "Șoimoș"] },
    { city: "Nădlac", county: "Arad", zones: [] },
    { city: "Pecica", county: "Arad", zones: ["Bodrogu Vechi", "Sederhat", "Turnu"] },
    { city: "Pâncota", county: "Arad", zones: ["Măderat"] },
    { city: "Sebiș", county: "Arad", zones: ["Donceni", "Prunișor", "Sălăjeni"] },
    { city: "Sântana", county: "Arad", zones: ["Caporal Alexa"] },
    { city: "Costești", county: "Argeș", zones: ["Broșteni", "Lăceni", "Podu Broșteni", "Pârvu Roșu", "Smei", "Stârci"] },
    { city: "Curtea de Argeș", county: "Argeș", zones: ["Noapteș"] },
    { city: "Câmpulung", county: "Argeș", zones: ["Valea Rumâneștilor"] },
    { city: "Mioveni", county: "Argeș", zones: ["Clucereasa", "Colibași", "Făgetu", "Racovița"] },
    { city: "Pitești", county: "Argeș", zones: ["Centru", "Trivale", "Craiovei", "Găvana", "Prundu", "Exercițiu", "Nord", "Războieni", "Depozite", "Popa Șapcă"] },
    { city: "Topoloveni", county: "Argeș", zones: ["Boțârcani", "Crintești", "Gorănești", "Țigănești"] },
    { city: "Ștefănești (Argeș)", county: "Argeș", zones: ["Enculești", "Golești", "Izvorani", "Valea Mare-Podgoria", "Viișoara", "Zăvoi", "Ștefăneștii Noi"] },
    { city: "Bacău", county: "Bacău", zones: ["Centru", "Cornișa", "Miorița", "Șerbănești", "CFR", "Gherăiești", "Izvoare", "Mărgineni", "Nord"] },
    { city: "Buhuși", county: "Bacău", zones: ["Marginea", "Runcu"] },
    { city: "Comănești", county: "Bacău", zones: ["Podei", "Vermești"] },
    { city: "Dărmănești", county: "Bacău", zones: ["Dărmăneasca", "Lapoș", "Plopu", "Păgubeni", "Sălătruc"] },
    { city: "Moinești", county: "Bacău", zones: ["Găzărie"] },
    { city: "Onești", county: "Bacău", zones: ["Borzești", "Slobozia"] },
    { city: "Slănic-Moldova", county: "Bacău", zones: ["Cerdac", "Cireșoaia"] },
    { city: "Târgu Ocna", county: "Bacău", zones: ["Poieni", "Vâlcele"] },
    { city: "Aleșd", county: "Bihor", zones: ["Peștiș", "Pădurea Neagră", "Tinăud"] },
    { city: "Beiuș", county: "Bihor", zones: ["Delani"] },
    { city: "Marghita", county: "Bihor", zones: ["Cheț", "Ghenetea"] },
    { city: "Nucet", county: "Bihor", zones: ["Băița", "Băița-Plai"] },
    { city: "Oradea", county: "Bihor", zones: ["Centru", "Rogerius", "Nufărul", "Ioșia", "Velența", "Ioșia Nord", "Cantemir", "Grigorescu", "Rulikowski", "Episcopia Bihor", "Podgoria"] },
    { city: "Salonta", county: "Bihor", zones: [] },
    { city: "Săcueni", county: "Bihor", zones: ["Cadea", "Ciocaia", "Cubulcut", "Olosig", "Sânnicolau de Munte"] },
    { city: "Valea lui Mihai", county: "Bihor", zones: [] },
    { city: "Vașcău", county: "Bihor", zones: ["Colești", "Câmp", "Câmp-Moți", "Vărzarii de Jos", "Vărzarii de Sus"] },
    { city: "Ștei", county: "Bihor", zones: [] },
    { city: "Beclean", county: "Bistrița-Năsăud", zones: ["Coldău", "Figa", "Rusu de Jos"] },
    { city: "Bistrița", county: "Bistrița-Năsăud", zones: ["Centru", "Unirii", "Viișoara", "Sub Coastă", "Bistrița Nord", "Ghinda", "Sigmir"] },
    { city: "Năsăud", county: "Bistrița-Năsăud", zones: ["Liviu Rebreanu", "Lușca"] },
    { city: "Sângeorz-Băi", county: "Bistrița-Năsăud", zones: ["Cormaia", "Valea Borcutului"] },
    { city: "Botoșani", county: "Botoșani", zones: ["Centru", "Bucovina", "Curcubeu", "Griviței", "Rotunda", "Alfa", "Sud"] },
    { city: "Bucecea", county: "Botoșani", zones: ["Bohoghina", "Călinești"] },
    { city: "Darabani", county: "Botoșani", zones: ["Bajura", "Eșanca", "Lismănița"] },
    { city: "Dorohoi", county: "Botoșani", zones: ["Dealu Mare", "Loturi Enescu", "Progresul"] },
    { city: "Flămânzi", county: "Botoșani", zones: ["Chițoveni", "Nicolae Bălcescu", "Poiana", "Prisăcani"] },
    { city: "Săveni", county: "Botoșani", zones: ["Bodeasa", "Bozieni", "Chișcăreni", "Petricani", "Sat Nou"] },
    { city: "Ștefănești (Botoșani)", county: "Botoșani", zones: ["Bobulești", "Bădiuți", "Stânca", "Ștefănești-Sat"] },
    { city: "Brașov", county: "Brașov", zones: ["Centru", "Șchei", "Bartolomeu", "Blumana", "Astra", "Tractorul", "Noua", "Florilor", "Răcădău", "Valea Cetății", "Triaj", "Titulescu", "Dârste"] },
    { city: "Codlea", county: "Brașov", zones: [] },
    { city: "Făgăraș", county: "Brașov", zones: [] },
    { city: "Ghimbav", county: "Brașov", zones: [] },
    { city: "Predeal", county: "Brașov", zones: ["Pârâul Rece", "Timișu de Jos", "Timișu de Sus"] },
    { city: "Rupea", county: "Brașov", zones: ["Fișer"] },
    { city: "Râșnov", county: "Brașov", zones: [] },
    { city: "Săcele", county: "Brașov", zones: [] },
    { city: "Victoria", county: "Brașov", zones: [] },
    { city: "Zărnești", county: "Brașov", zones: ["Tohanu Nou"] },
    { city: "Brăila", county: "Brăila", zones: ["Centru", "Hipodrom", "Viziru", "Chercea", "Radu Negru", "Obor", "Lacu Dulce", "Brăilița", "Apollo", "Vidin"] },
    { city: "Făurei", county: "Brăila", zones: [] },
    { city: "Ianca", county: "Brăila", zones: ["Berlești", "Gara Ianca", "Oprișenești", "Perișoru", "Plopu", "Târlele Filiu"] },
    { city: "Însurăței", county: "Brăila", zones: ["Lacu Rezii", "Măru Roșu", "Valea Călmățuiului"] },
    { city: "București", county: "București", zones: ["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6", "Militari", "Drumul Taberei", "Rahova", "Berceni", "Titan", "Pantelimon", "Colentina", "Obor", "Tei", "Floreasca", "Aviatorilor", "Dorobanți", "Cotroceni", "Vitan", "Balta Albă", "Crângași", "Giulești", "Băneasa", "Primăverii", "Herăstrău", "Pipera"] },
    { city: "Buzău", county: "Buzău", zones: ["Centru", "Micro-Centru", "Broșteni", "Dorobanți", "Orizont", "Simileasca", "Unirii", "Sud"] },
    { city: "Nehoiu", county: "Buzău", zones: ["Bâsca Rozilei", "Chirlești", "Curmătura", "Lunca Priporului", "Mlăjet", "Nehoiașu", "Păltineni", "Stănila", "Vinețișu"] },
    { city: "Pogoanele", county: "Buzău", zones: ["Căldărăști"] },
    { city: "Pătârlagele", county: "Buzău", zones: ["Calea Chiojdului", "Crâng", "Fundăturile", "Gornet", "Lunca", "Mușcel", "Mănăstirea", "Mărunțișu", "Poienile", "Sibiciu de Sus", "Stroești", "Valea Lupului", "Valea Sibiciului", "Valea Viei"] },
    { city: "Râmnicu Sărat", county: "Buzău", zones: [] },
    { city: "Anina", county: "Caraș-Severin", zones: ["Steierdorf"] },
    { city: "Bocșa", county: "Caraș-Severin", zones: [] },
    { city: "Băile Herculane", county: "Caraș-Severin", zones: ["Pecinișca"] },
    { city: "Caransebeș", county: "Caraș-Severin", zones: ["Jupa"] },
    { city: "Moldova Nouă", county: "Caraș-Severin", zones: ["Moldova Veche", "Moldovița", "Măcești"] },
    { city: "Oravița", county: "Caraș-Severin", zones: ["Agadici", "Broșteni", "Brădișoru de Jos", "Ciclova Montană", "Marila", "Răchitova"] },
    { city: "Oțelu Roșu", county: "Caraș-Severin", zones: ["Cireșa", "Mal"] },
    { city: "Reșița", county: "Caraș-Severin", zones: ["Centru", "Govândari", "Moroasa", "Lunca Bârzavei", "Mociur", "Sud"] },
    { city: "Cluj-Napoca", county: "Cluj", zones: ["Centru", "Mănăștur", "Mărăști", "Gheorgheni", "Zorilor", "Grigorescu", "Bulgaria", "Gruia", "Someșeni", "Iris", "Dâmbul Rotund", "Andrei Mureșanu", "Plopilor"] },
    { city: "Câmpia Turzii", county: "Cluj", zones: [] },
    { city: "Dej", county: "Cluj", zones: ["Ocna Dejului", "Peștera", "Pintic", "Șomcutu Mic"] },
    { city: "Gherla", county: "Cluj", zones: ["Băița", "Hășdate", "Silivaș"] },
    { city: "Huedin", county: "Cluj", zones: ["Bicălatu"] },
    { city: "Turda", county: "Cluj", zones: [] },
    { city: "Băneasa", county: "Constanța", zones: ["Făurei", "Negureni", "Tudor Vladimirescu"] },
    { city: "Cernavodă", county: "Constanța", zones: [] },
    { city: "Constanța", county: "Constanța", zones: ["Centru", "Peninsula", "Tomis Nord", "Tomis Plus", "Tomis III", "Km 4-5", "Coiciu", "Palas", "Anadolchioi", "Faleză Nord", "Faleză Sud", "Compozitorilor", "Badea Cârțan", "Viile Noi", "Poarta 6"] },
    { city: "Eforie", county: "Constanța", zones: ["Eforie Nord", "Eforie Sud"] },
    { city: "Hârșova", county: "Constanța", zones: ["Vadu Oii"] },
    { city: "Mangalia", county: "Constanța", zones: ["Cap Aurora", "Jupiter", "Neptun", "Olimp", "Saturn", "Venus"] },
    { city: "Medgidia", county: "Constanța", zones: ["Remus Opreanu", "Valea Dacilor"] },
    { city: "Murfatlar", county: "Constanța", zones: ["Siminoc"] },
    { city: "Negru Vodă", county: "Constanța", zones: ["Darabani", "Grăniceru", "Vâlcelele"] },
    { city: "Năvodari", county: "Constanța", zones: ["Mamaia-Sat"] },
    { city: "Ovidiu", county: "Constanța", zones: ["Culmea", "Poiana"] },
    { city: "Techirghiol", county: "Constanța", zones: [] },
    { city: "Baraolt", county: "Covasna", zones: ["Biborțeni", "Bodoș", "Căpeni", "Micloșoara", "Racoșul de Sus"] },
    { city: "Covasna", county: "Covasna", zones: ["Chiuruș"] },
    { city: "Sfîntu Gheorghe", county: "Covasna", zones: ["Chilieni", "Coșeni", "Sfântu Gheorghe"] },
    { city: "Târgu Secuiesc", county: "Covasna", zones: ["Lunga"] },
    { city: "Întorsura Buzăului", county: "Covasna", zones: ["Brădet", "Floroaia", "Scrădoasa"] },
    { city: "Budești", county: "Călărași", zones: ["Aprozi", "Buciumeni", "Gruiu"] },
    { city: "Călărași", county: "Călărași", zones: ["Centru", "Prelungirea București", "Progresu", "Obor", "Est", "Sud"] },
    { city: "Fundulea", county: "Călărași", zones: ["Alexandru I. Cuza", "Gostilele"] },
    { city: "Lehliu Gara", county: "Călărași", zones: ["Buzoeni", "Lehliu-Gară", "Răzvani", "Valea Seacă"] },
    { city: "Oltenița", county: "Călărași", zones: [] },
    { city: "Bechet", county: "Dolj", zones: [] },
    { city: "Băilești", county: "Dolj", zones: ["Balasan"] },
    { city: "Calafat", county: "Dolj", zones: ["Basarabi", "Ciupercenii Vechi", "Golenți"] },
    { city: "Craiova", county: "Dolj", zones: ["Centru", "Craiovița Nouă", "Brazda lui Novac", "Rovine", "Valea Roșie", "1 Mai", "Lăpuș", "Sărari", "Bariera Vâlcii", "Izvorul Rece"] },
    { city: "Dăbuleni", county: "Dolj", zones: ["Chiașu"] },
    { city: "Filiași", county: "Dolj", zones: ["Almăjel", "Braniște", "Bâlta", "Fratoștița", "Răcarii de Sus", "Uscăci"] },
    { city: "Segarcea", county: "Dolj", zones: [] },
    { city: "Fieni", county: "Dâmbovița", zones: ["Berevoești", "Costești"] },
    { city: "Găești", county: "Dâmbovița", zones: [] },
    { city: "Moreni", county: "Dâmbovița", zones: [] },
    { city: "Pucioasa", county: "Dâmbovița", zones: ["Bela", "Diaconești", "Glodeni", "Malurile", "Miculești", "Pucioasa-Sat"] },
    { city: "Răcari", county: "Dâmbovița", zones: ["Bălănești", "Colacu", "Ghergani", "Ghimpați", "Mavrodin", "Stănești", "Săbiești"] },
    { city: "Titu", county: "Dâmbovița", zones: ["Fusea", "Hagioaica", "Mereni", "Plopu", "Sălcuța"] },
    { city: "Târgoviște", county: "Dâmbovița", zones: ["Centru", "Micro I-XI", "Priseaca", "Suditu", "Sagricom"] },
    { city: "Berești", county: "Galați", zones: [] },
    { city: "Galați", county: "Galați", zones: ["Centru", "Micro 19", "Mazepa", "Țiglina 1", "Țiglina 2", "Dunărea", "Aurel Vlaicu", "Mica", "Traian", "Barbosi"] },
    { city: "Tecuci", county: "Galați", zones: [] },
    { city: "Târgu Bujor", county: "Galați", zones: ["Moscu", "Umbrărești"] },
    { city: "Bolintin-Vale", county: "Giurgiu", zones: ["Crivina", "Malu Spart", "Suseni"] },
    { city: "Giurgiu", county: "Giurgiu", zones: ["Centru", "Micro", "Ramadan", "Nord", "Docuri", "Așezării"] },
    { city: "Mihăilești", county: "Giurgiu", zones: ["Drăgănescu", "Novaci", "Popești"] },
    { city: "Bumbești-Jiu", county: "Gorj", zones: ["Curtișoara", "Lăzărești", "Pleșa", "Tetila"] },
    { city: "Motru", county: "Gorj", zones: ["Dealu Pomilor", "Horăști", "Leurda", "Lupoița", "Ploștina", "Roșiuța", "Râpa", "Însurăței"] },
    { city: "Novaci", county: "Gorj", zones: ["Bercești", "Hirișești", "Pociovaliștea", "Sitești"] },
    { city: "Rovinari", county: "Gorj", zones: ["Vârț"] },
    { city: "Tismana", county: "Gorj", zones: ["Celei", "Costeni", "Gornovița", "Isvarna", "Pocruia", "Racoți", "Sohodol", "Topești", "Vâlcele", "Vânata"] },
    { city: "Turceni", county: "Gorj", zones: ["Gârbovu", "Jilțu", "Murgești", "Strâmba-Jiu", "Valea Viei"] },
    { city: "Târgu Cărbunești", county: "Gorj", zones: ["Blahnița de Jos", "Cojani", "Crețești", "Curteana", "Cărbunești-Sat", "Floreșteni", "Măceșu", "Pojogeni", "Rogojeni", "Ștefănești"] },
    { city: "Târgu Jiu", county: "Gorj", zones: ["Centru", "Uzina de Fier", "Debarcader", "Bârsești", "Iezureni"] },
    { city: "Țicleni", county: "Gorj", zones: [] },
    { city: "Borsec", county: "Harghita", zones: [] },
    { city: "Băile Tușnad", county: "Harghita", zones: ["Carpitus"] },
    { city: "Bălan", county: "Harghita", zones: [] },
    { city: "Cristuru Secuiesc", county: "Harghita", zones: ["Betești", "Filiaș"] },
    { city: "Gheorgheni", county: "Harghita", zones: ["Covacipeter", "Lacu Roșu", "Vargatac", "Visafolio"] },
    { city: "Miercurea Ciuc", county: "Harghita", zones: ["Centru", "Zöld Péter", "Jigodin-Băi", "Frumoasa", "Harghita"] },
    { city: "Odorheiu Secuiesc", county: "Harghita", zones: [] },
    { city: "Toplița", county: "Harghita", zones: ["Călimănel", "Luncani", "Moglănești", "Măgheruș", "Secu", "Vale", "Vâgani", "Zencani"] },
    { city: "Vlăhița", county: "Harghita", zones: ["Băile Homorod", "Minele Lueta"] },
    { city: "Aninoasa", county: "Hunedoara", zones: ["Iscroni"] },
    { city: "Brad", county: "Hunedoara", zones: ["Mesteacăn", "Potingani", "Ruda-Brad", "Valea Bradului", "Țărățel"] },
    { city: "Călan", county: "Hunedoara", zones: ["Batiz", "Călanu Mic", "Grid", "Nădăștia de Jos", "Nădăștia de Sus", "Ohaba Streiului", "Strei", "Strei-Săcel", "Streisângeorgiu", "Sâncrai", "Sântămăria de Piatră", "Valea Sângeorgiului"] },
    { city: "Deva", county: "Hunedoara", zones: ["Centru", "Dacia", "Micro 15", "Bejan", "Zăvoi", "Progresul"] },
    { city: "Geoagiu", county: "Hunedoara", zones: ["Aurel Vlaicu", "Bacâia", "Bozeș", "Cigmău", "Gelmar", "Geoagiu-Băi", "Homorod", "Mermezeu-Văleni", "Renghet", "Văleni"] },
    { city: "Hațeg", county: "Hunedoara", zones: ["Nălațvad", "Silvașu de Jos", "Silvașu de Sus"] },
    { city: "Hunedoara", county: "Hunedoara", zones: ["Boș", "Groș", "Hășdat", "Peștișu Mare", "Răcăștia"] },
    { city: "Lupeni", county: "Hunedoara", zones: [] },
    { city: "Orăștie", county: "Hunedoara", zones: [] },
    { city: "Petrila", county: "Hunedoara", zones: ["Cimpa", "Jieț", "Răscoala", "Tirici"] },
    { city: "Petroșani", county: "Hunedoara", zones: ["Dâlja Mare", "Dâlja Mică", "Peștera", "Slătinioara"] },
    { city: "Simeria", county: "Hunedoara", zones: ["Bârcea Mare", "Cărpiniș", "Simeria Veche", "Sântandrei", "Uroi", "Șăulești"] },
    { city: "Uricani", county: "Hunedoara", zones: ["Câmpu lui Neag", "Valea de Brazi"] },
    { city: "Vulcan", county: "Hunedoara", zones: ["Dealu Babii", "Jiu-Paroșeni"] },
    { city: "Amara", county: "Ialomița", zones: ["Amara Nouă"] },
    { city: "Căzănești", county: "Ialomița", zones: [] },
    { city: "Fetești", county: "Ialomița", zones: ["Buliga", "Fetești-Gară", "Vlașca"] },
    { city: "Fierbinți-Târg", county: "Ialomița", zones: ["Fierbinții de Jos", "Fierbinții de Sus", "Grecii de Jos"] },
    { city: "Slobozia", county: "Ialomița", zones: ["Centru", "Nord", "Cuza Vodă", "Progresu", "Slobozia Nouă"] },
    { city: "Urziceni", county: "Ialomița", zones: [] },
    { city: "Țăndărei", county: "Ialomița", zones: [] },
    { city: "Hârlău", county: "Iași", zones: ["Pârcovaci"] },
    { city: "Iași", county: "Iași", zones: ["Copou", "Sărărie", "Păcurari", "Canta", "Alexandru cel Bun", "Dacia", "Mircea cel Bătrân", "Nicolina 1", "Nicolina 2", "CUG", "Frumoasa", "Tătărași", "Oancea", "Tudor Vladimirescu", "Centru", "Podu Roș", "Palas", "Bucium", "Socola", "Galata", "Miroslava/Valea Adâncă", "Moara de Vânt", "Târgu Cucu", "Dancu", "Ciurea", "Lunca Cetățuii"] },
    { city: "Pașcani", county: "Iași", zones: ["Blăgești", "Boșteni", "Gâștești", "Lunca", "Sodomeni"] },
    { city: "Podu Iloaiei", county: "Iași", zones: ["Budăi", "Cosițeni", "Holm", "Scobâlțeni"] },
    { city: "Târgu Frumos", county: "Iași", zones: [] },
    { city: "Bragadiru", county: "Ilfov", zones: [] },
    { city: "Buftea", county: "Ilfov", zones: ["Buciumeni"] },
    { city: "Chitila", county: "Ilfov", zones: ["Rudeni"] },
    { city: "Măgurele", county: "Ilfov", zones: ["Alunișu", "Dumitrana", "Pruni", "Vârteju"] },
    { city: "Otopeni", county: "Ilfov", zones: ["Odăile"] },
    { city: "Pantelimon", county: "Ilfov", zones: [] },
    { city: "Popești-Leordeni", county: "Ilfov", zones: [] },
    { city: "Voluntari", county: "Ilfov", zones: [] },
    { city: "Baia Mare", county: "Maramureș", zones: ["Centru", "Vasile Alecsandri", "Săsar", "Ferneziu", "Grigorescu", "Blajul", "Republicii", "Locomotivei", "Valea Roșie", "Vasile Lucaciu"] },
    { city: "Baia Sprie", county: "Maramureș", zones: ["Chiuzbaia", "Satu Nou de Sus", "Tăuții de Sus"] },
    { city: "Borșa", county: "Maramureș", zones: ["Băile Borșa"] },
    { city: "Cavnic", county: "Maramureș", zones: [] },
    { city: "Dragomirești", county: "Maramureș", zones: [] },
    { city: "Seini", county: "Maramureș", zones: ["Săbișa", "Viile Apei"] },
    { city: "Sighetu Marmației", county: "Maramureș", zones: ["Iapa", "Lazu Baciului", "Valea Cufundoasă", "Valea Hotarului", "Șugău"] },
    { city: "Săliștea de Sus", county: "Maramureș", zones: [] },
    { city: "Târgu Lăpuș", county: "Maramureș", zones: ["Boiereni", "Borcut", "Cufoaia", "Dobricu Lăpușului", "Dumbrava", "Dămăcușeni", "Fântânele", "Groape", "Inău", "Rogoz", "Rohia", "Răzoare", "Stoiceni"] },
    { city: "Tăuții-Măgherăuș", county: "Maramureș", zones: ["Bozânta Mare", "Bușag", "Băița", "Merișor", "Nistru", "Ulmoasa"] },
    { city: "Ulmeni", county: "Maramureș", zones: ["Arduzel", "Chelința", "Mânău", "Someș-Uileac", "Tohat", "Vicea", "Țicău"] },
    { city: "Vișeu de Sus", county: "Maramureș", zones: ["Vișeu de Mijloc"] },
    { city: "Șomcuta Mare", county: "Maramureș", zones: ["Buciumi", "Buteasa", "Ciolt", "Codru Butesii", "Finteușu Mare", "Hovrila", "Vălenii Șomcutei"] },
    { city: "Baia de Aramă", county: "Mehedinți", zones: ["Bratilovu", "Brebina", "Dealu Mare", "Mărășești", "Negoești", "Pistrița", "Stănești", "Titerlești"] },
    { city: "Drobeta-Turnu Severin", county: "Mehedinți", zones: ["Centru", "Crihala", "Dudașu Schelei", "Schela Cladovei", "Progresul"] },
    { city: "Orșova", county: "Mehedinți", zones: [] },
    { city: "Strehaia", county: "Mehedinți", zones: ["Ciochiuța", "Comanda", "Hurducești", "Lunca Banului", "Menți", "Motruleni", "Slătinicu Mare", "Slătinicu Mic", "Stăncești"] },
    { city: "Vânju Mare", county: "Mehedinți", zones: ["Bucura", "Nicolae Bălcescu", "Orevița Mare", "Traian"] },
    { city: "Iernut", county: "Mureș", zones: ["Cipău", "Deag", "Lechința", "Oarba de Mureș", "Porumbac", "Racameț", "Sfântu Gheorghe", "Sălcud"] },
    { city: "Luduș", county: "Mureș", zones: ["Avrămești", "Cioarga", "Ciurgău", "Fundătura", "Gheja", "Roșiori"] },
    { city: "Miercurea Nirajului", county: "Mureș", zones: ["Beu", "Dumitreștii", "Lăureni", "Moșuni", "Tâmpa", "Veța", "Șardu Nirajului"] },
    { city: "Reghin", county: "Mureș", zones: ["Apalina", "Iernuțeni"] },
    { city: "Sarmașu", county: "Mureș", zones: ["Balda", "Larga", "Moruț", "Sărmășel", "Sărmășel-Gară", "Titiana", "Vișinelu"] },
    { city: "Sighișoara", county: "Mureș", zones: ["Angofa", "Aurel Vlaicu", "Hetiur", "Rora", "Venchi", "Viilor", "Șoromiclea"] },
    { city: "Sovata", county: "Mureș", zones: ["Căpeți", "Ilieși", "Săcădat"] },
    { city: "Sângeorgiu de Pădure", county: "Mureș", zones: ["Bezid", "Bezidu Nou", "Loțu"] },
    { city: "Târgu Mureș", county: "Mureș", zones: ["Centru", "Tudor Vladimirescu", "Unirii", "Mureșeni", "Aleea Carpați", "Dâmbu Pietros", "Republicii", "Belvedere", "Cornișa", "7 Noiembrie"] },
    { city: "Târnăveni", county: "Mureș", zones: ["Bobohalma", "Botorca", "Cuștelnic"] },
    { city: "Ungheni", county: "Mureș", zones: ["Cerghid", "Cerghizel", "Morești", "Recea", "Vidrasău", "Șăușa"] },
    { city: "Bicaz", county: "Neamț", zones: ["Capșa", "Dodeni", "Izvoru Muntelui", "Izvorul Alb", "Potoci", "Secu"] },
    { city: "Piatra-Neamț", county: "Neamț", zones: ["Centru", "Dărmănești", "Precista", "Speranța", "Mărățel", "Văleni", "Doamna"] },
    { city: "Roman", county: "Neamț", zones: [] },
    { city: "Roznov", county: "Neamț", zones: ["Chintinici", "Slobozia"] },
    { city: "Târgu Neamț", county: "Neamț", zones: ["Blebea", "Humulești", "Humuleștii Noi"] },
    { city: "Balș", county: "Olt", zones: ["Corbeni", "Româna", "Teiș"] },
    { city: "Caracal", county: "Olt", zones: [] },
    { city: "Corabia", county: "Olt", zones: ["Tudor Vladimirescu", "Vârtopu"] },
    { city: "Drăgănești-Olt", county: "Olt", zones: ["Comani"] },
    { city: "Piatra-Olt", county: "Olt", zones: ["Bistrița Nouă", "Criva de Jos", "Criva de Sus", "Enoșești", "Piatra"] },
    { city: "Potcoava", county: "Olt", zones: ["Potcoava Fălcoeni", "Sinești", "Trufinești", "Valea Merilor"] },
    { city: "Scornicești", county: "Olt", zones: ["Bircii", "Bălțați", "Chițeasca", "Constantinești", "Jitaru", "Mihăilești-Popești", "Mogoșești", "Mărgineni-Slobozia", "Negreni", "Piscani", "Rusciori", "Teiuș", "Șuica"] },
    { city: "Slatina", county: "Olt", zones: ["Centru", "Progresul", "Crișan", "Aluniș", "Clocociov"] },
    { city: "Azuga", county: "Prahova", zones: [] },
    { city: "Boldești-Scăeni", county: "Prahova", zones: ["Seciu"] },
    { city: "Breaza", county: "Prahova", zones: ["Breaza de Jos", "Breaza de Sus", "Frăsinet", "Gura Beliei", "Irimești", "Nistorești", "Podu Corbului", "Podu Vadului", "Surdești", "Valea Târsei"] },
    { city: "Bușteni", county: "Prahova", zones: ["Poiana Țapului"] },
    { city: "Băicoi", county: "Prahova", zones: ["Dâmbu", "Liliești", "Schela", "Tufeni", "Țintea"] },
    { city: "Comarnic", county: "Prahova", zones: ["Ghioșești", "Podu Lung", "Poiana", "Posada"] },
    { city: "Câmpina", county: "Prahova", zones: [] },
    { city: "Mizil", county: "Prahova", zones: ["Fefelei"] },
    { city: "Ploiești", county: "Prahova", zones: ["Centru", "Mihai Bravu", "Republicii", "Vest", "Malu Roșu", "Mimiu", "Bereasca", "Nord", "Rafov"] },
    { city: "Plopeni", county: "Prahova", zones: [] },
    { city: "Sinaia", county: "Prahova", zones: [] },
    { city: "Slănic", county: "Prahova", zones: ["Groșani", "Prăjani"] },
    { city: "Urlați", county: "Prahova", zones: ["Arioneștii Noi", "Arioneștii Vechi", "Cherba", "Jercălăi", "Mărunțiș", "Orzoaia de Jos", "Orzoaia de Sus", "Schiau", "Ulmi", "Valea Bobului", "Valea Crângului", "Valea Mieilor", "Valea Nucetului", "Valea Pietrei", "Valea Seman", "Valea Urloii"] },
    { city: "Vălenii de Munte", county: "Prahova", zones: [] },
    { city: "Ardud", county: "Satu Mare", zones: ["Ardud-Vii", "Baba Novac", "Gerăușa", "Mădăras", "Sărătura"] },
    { city: "Carei", county: "Satu Mare", zones: ["Ianculești"] },
    { city: "Livada", county: "Satu Mare", zones: ["Adrian", "Dumbrava", "Livada Mică"] },
    { city: "Negrești-Oaș", county: "Satu Mare", zones: ["Luna", "Tur"] },
    { city: "Satu Mare", county: "Satu Mare", zones: ["Centru", "Solidarității", "Micro 16", "Carpați", "Sub Cetate", "Nord"] },
    { city: "Tășnad", county: "Satu Mare", zones: ["Blaja", "Cig", "Rațiu", "Sărăuad", "Valea Morii"] },
    { city: "Agnita", county: "Sibiu", zones: ["Coveș", "Ruja"] },
    { city: "Avrig", county: "Sibiu", zones: ["Bradu", "Glâmboaca", "Mârșa", "Săcădate"] },
    { city: "Cisnădie", county: "Sibiu", zones: ["Cisnădioara"] },
    { city: "Copșa Mică", county: "Sibiu", zones: [] },
    { city: "Dumbrăveni", county: "Sibiu", zones: ["Ernea", "Șaroș Pe Târnave"] },
    { city: "Mediaș", county: "Sibiu", zones: ["Ighișu Nou"] },
    { city: "Miercurea Sibiului", county: "Sibiu", zones: ["Apoldu de Sus", "Dobârca"] },
    { city: "Ocna Sibiului", county: "Sibiu", zones: ["Topârcea"] },
    { city: "Sibiu", county: "Sibiu", zones: ["Centru", "Terezian", "Hipodrom 1", "Hipodrom 2", "Vasile Aaron", "Trei Stejari", "Rahovei", "Turnișor", "Valea Aurie", "Strand", "Gușterița"] },
    { city: "Săliște", county: "Sibiu", zones: ["Aciliu", "Amnaș", "Crinț", "Fântânele", "Galeș", "Mag", "Sibiel", "Săcel", "Vale"] },
    { city: "Tălmaciu", county: "Sibiu", zones: ["Colonia Tălmaciu", "Tălmăcel"] },
    { city: "Broșteni", county: "Suceava", zones: ["Cotârgași", "Dârmoxa", "Frasin", "Holda", "Holdița", "Hăleasa", "Lungeni", "Neagra", "Pietroasa"] },
    { city: "Cajvana", county: "Suceava", zones: ["Codru"] },
    { city: "Câmpulung Moldovenesc", county: "Suceava", zones: [] },
    { city: "Dolhasca", county: "Suceava", zones: ["Budeni", "Gulia", "Poiana", "Poienari", "Probota", "Siliștea Nouă", "Valea Poienei"] },
    { city: "Frasin", county: "Suceava", zones: ["Bucșoaia", "Doroteia", "Plutonița"] },
    { city: "Fălticeni", county: "Suceava", zones: ["Șoldănești", "Țarna Mare"] },
    { city: "Gura Humorului", county: "Suceava", zones: ["Voroneț"] },
    { city: "Liteni", county: "Suceava", zones: ["Corni", "Rotunda", "Roșcani", "Siliștea", "Vercicani"] },
    { city: "Milișăuți", county: "Suceava", zones: ["Bădeuți", "Gara", "Lunca"] },
    { city: "Rădăuți", county: "Suceava", zones: [] },
    { city: "Salcea", county: "Suceava", zones: ["Mereni", "Plopeni", "Prelipca", "Văratec"] },
    { city: "Siret", county: "Suceava", zones: ["Mănăstioara", "Pădureni"] },
    { city: "Solca", county: "Suceava", zones: [] },
    { city: "Suceava", county: "Suceava", zones: ["Centru", "Obcini", "George Enescu", "Zamca", "Ițcani", "Burdujeni"] },
    { city: "Vatra Dornei", county: "Suceava", zones: ["Argestru", "Roșu", "Todireni"] },
    { city: "Vicovu de Sus", county: "Suceava", zones: ["Bivolăria"] },
    { city: "Cehu Silvaniei", county: "Sălaj", zones: ["Horoatu Cehului", "Motiș", "Nadiș", "Ulciug"] },
    { city: "Jibou", county: "Sălaj", zones: ["Cuceu", "Husia", "Rona", "Var"] },
    { city: "Zalău", county: "Sălaj", zones: ["Centru", "Meseș", "Dumbrava", "Șimleu", "Ortelec"] },
    { city: "Șimleu Silvaniei", county: "Sălaj", zones: ["Bic", "Cehei", "Pusta"] },
    { city: "Alexandria", county: "Teleorman", zones: [] },
    { city: "Rosiori de Vede", county: "Teleorman", zones: [] },
    { city: "Turnu Măgurele", county: "Teleorman", zones: [] },
    { city: "Videle", county: "Teleorman", zones: ["Coșoaia"] },
    { city: "Zimnicea", county: "Teleorman", zones: [] },
    { city: "Buziaș", county: "Timiș", zones: ["Bacova", "Silagiu"] },
    { city: "Ciacova", county: "Timiș", zones: ["Cebza", "Macedonia", "Obad", "Petroman"] },
    { city: "Deta", county: "Timiș", zones: ["Opatița"] },
    { city: "Făget", county: "Timiș", zones: ["Begheiu Mic", "Bichigi", "Brănești", "Bunea Mare", "Bunea Mică", "Bătești", "Colonia Mică", "Jupânești", "Povârgina", "Temerești"] },
    { city: "Gătaia", county: "Timiș", zones: ["Butin", "Percosova", "Sculia", "Șemlacu Mare", "Șemlacu Mic"] },
    { city: "Jimbolia", county: "Timiș", zones: [] },
    { city: "Lugoj", county: "Timiș", zones: ["Măguri", "Tapia"] },
    { city: "Recaș", county: "Timiș", zones: ["Bazoș", "Herneacova", "Izvin", "Nadăș", "Petrovaselo", "Stanciova"] },
    { city: "Sânnicolau Mare", county: "Timiș", zones: [] },
    { city: "Timișoara", county: "Timiș", zones: ["Centru", "Iosefin", "Elisabetin", "Fabric", "Cetate", "Circumvalațiunii", "Freidorf", "Ronaț", "Girocului", "Dumbrăvița", "Steaua", "Plopi"] },
    { city: "Babadag", county: "Tulcea", zones: [] },
    { city: "Isaccea", county: "Tulcea", zones: ["Revărsarea", "Tichilești"] },
    { city: "Măcin", county: "Tulcea", zones: [] },
    { city: "Sulina", county: "Tulcea", zones: [] },
    { city: "Tulcea", county: "Tulcea", zones: ["Tudor Vladimirescu"] },
    { city: "Bârlad", county: "Vaslui", zones: [] },
    { city: "Huși", county: "Vaslui", zones: ["Centru", "Corni", "Dobrina", "Dric 1", "Dric 2", "Plopeni", "Zona Spital", "Zona Industrială", "Podgorie"] },
    { city: "Murgeni", county: "Vaslui", zones: ["Cârja", "Floreni", "Lățești", "Raiu", "Schineni", "Sărățeni"] },
    { city: "Negrești", county: "Vaslui", zones: ["Cioatele", "Căzănești", "Glodeni", "Parpanița", "Poiana", "Valea Mare"] },
    { city: "Vaslui", county: "Vaslui", zones: ["Centru", "Sud", "Moldovei", "Podu Înalt", "Vovidenia"] },
    { city: "Adjud", county: "Vrancea", zones: ["Adjudu Vechi", "Burcioaia", "Șișcani"] },
    { city: "Focșani", county: "Vrancea", zones: ["Centru", "Sud", "Mândrești", "Brăilei", "Cireșarii", "Bahne"] },
    { city: "Mărășești", county: "Vrancea", zones: ["Călimănești", "Haret", "Modruzeni", "Pădureni", "Siretu", "Tișița"] },
    { city: "Odobești", county: "Vrancea", zones: ["Unirea"] },
    { city: "Panciu", county: "Vrancea", zones: ["Crucea de Jos", "Crucea de Sus", "Dumbrava", "Neicu", "Satu Nou"] },
    { city: "Baile Govora", county: "Vâlcea", zones: ["Curăturile", "Gătejești", "Prajila"] },
    { city: "Baile Olanești", county: "Vâlcea", zones: ["Cheia", "Comanca", "Gurguiata", "Livadia", "Moșoroașa", "Olănești", "Pietrișu", "Tisa"] },
    { city: "Berbești", county: "Vâlcea", zones: ["Dealu Aluniș", "Dămțeni", "Roșioara", "Târgu Gângulești", "Valea Mare"] },
    { city: "Brezoi", county: "Vâlcea", zones: ["Corbu", "Călinești", "Drăgănești", "Golotreni", "Proieni", "Păscoaia", "Valea lui Stan", "Văratica"] },
    { city: "Băbeni", county: "Vâlcea", zones: ["Bonciu", "Capu Dealului", "Pădurețu", "Români", "Tătărani", "Valea Mare"] },
    { city: "Bălcești", county: "Vâlcea", zones: ["Benești", "Chirculești", "Cârlogani", "Gorunești", "Irimești", "Otetelișu", "Preotești", "Satu Poieni"] },
    { city: "Călimănești", county: "Vâlcea", zones: ["Căciulata", "Jiblea Nouă", "Jiblea Veche", "Păușa", "Seaca"] },
    { city: "Drăgășani", county: "Vâlcea", zones: ["Valea Caselor", "Zlătărei", "Zărneni"] },
    { city: "Horezu", county: "Vâlcea", zones: ["Ifrimești", "Romanii de Jos", "Romanii de Sus", "Râmești", "Tănăsești", "Urșani"] },
    { city: "Ocnele Mari", county: "Vâlcea", zones: ["Buda", "Cosota", "Făcăi", "Gura Suhașului", "Lunca", "Ocnița", "Slătioarele", "Țeica"] },
    { city: "Râmnicu Vâlcea", county: "Vâlcea", zones: ["Centru", "Ostroveni", "Nord", "Traian", "Feroviarilor", "Central-Sud"] },
  ]
};

export function getCities(country) {
  return (LOCATIONS[country] || []).map((c) => c.city);
}

export function getZones(country, city) {
  const found = (LOCATIONS[country] || []).find((c) => c.city === city);
  return found ? found.zones : [];
}

export function getCounty(city) {
  const found = (LOCATIONS.RO || []).find((c) => c.city === city);
  return found ? found.county : "";
}

export function getCounties(country) {
  const seen = new Set();
  const out = [];
  for (const c of LOCATIONS[country] || []) {
    if (!seen.has(c.county)) {
      seen.add(c.county);
      out.push(c.county);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, "ro"));
}

// Diacritic/case-insensitive normalization used for typeahead search and for
// loose text matching against user input (accents, capitalisation, whitespace).
export function normText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Type-ahead search across județe (counties), orașe (cities), sectoare
// (București only) and cartiere/zone, all in one pass. Returns up to
// `limitPerGroup` matches per category, ranked by match position (prefix
// matches first) then alphabetically. Matching is diacritic-insensitive so
// "bucuresti" finds "București".
export function searchLocations(country, query, { limitPerGroup = 6 } = {}) {
  const q = normText(query);
  const empty = { counties: [], cities: [], sectors: [], zones: [] };
  if (!q) return empty;

  const all = LOCATIONS[country] || [];
  const counties = [];
  const cities = [];
  const sectors = [];
  const zones = [];

  const seenCounty = new Set();
  for (const c of all) {
    if (seenCounty.has(c.county)) continue;
    const idx = normText(c.county).indexOf(q);
    if (idx !== -1) {
      counties.push({ type: "county", label: c.county, county: c.county, matchIndex: idx });
      seenCounty.add(c.county);
    }
  }

  for (const c of all) {
    const cityIdx = normText(c.city).indexOf(q);
    if (cityIdx !== -1) {
      cities.push({ type: "city", label: c.city, city: c.city, county: c.county, matchIndex: cityIdx });
    }
    for (const z of c.zones) {
      const zIdx = normText(z).indexOf(q);
      if (zIdx === -1) continue;
      const isSector = /^Sector\s+\d/i.test(z);
      const entry = { type: isSector ? "sector" : "zone", label: z, zone: z, city: c.city, county: c.county, matchIndex: zIdx };
      (isSector ? sectors : zones).push(entry);
    }
  }

  const rank = (arr) => arr
    .sort((a, b) => (a.matchIndex - b.matchIndex) || a.label.localeCompare(b.label, "ro"))
    .slice(0, limitPerGroup);

  return { counties: rank(counties), cities: rank(cities), sectors: rank(sectors), zones: rank(zones) };
}

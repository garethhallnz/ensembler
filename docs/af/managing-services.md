# Bestuur van jou dienste

Alles gebeur op die **kontroleskerm**. Elke diens het ’n kaart wat sy status en
die aksies wat jy kan neem, wys.

## Dienskaarte

- ’n Gekleurde **statuskolletjie** wys jou die toestand met een oogopslag:
  - **groen — Aan die loop**
  - **grys — Gestop**
  - **amber — Opstelling nodig** of **Aandag nodig**
- **Maak oop** maak die diens **binne Ensembler as ’n oortjie** oop — geen aparte
  blaaier, en geen "Not Secure"-waarskuwing nie. ’n Balk langs die bokant laat jou
  wissel tussen die **Kontroleskerm** en enige oop dienste, en ’n oortjie met sy
  **✕** toemaak. Dit het ook ’n **herlaai**- en ’n **maak-in-blaaier-oop**-knoppie
  vir die huidige diens.
- ’n Klein **weergawe** verskyn op elke lopende kaart. ’n **🔒 slot** beteken die
  diens is aan ’n spesifieke weergawe vasgesit; die **↻**-merker beteken dit volg
  die nuutste. Dit word amber wanneer ’n opdatering beskikbaar is.
- Die **⋯-kieslys** hou die res: **Maak in blaaier oop**, **Begin / Stop**,
  **Herbegin**, **Bekyk logboeke**, **Kontroleer vir opdaterings**, en
  **Konfigureer**.

Terwyl ’n diens begin of stop, wys die status ’n kort
"Begin tans…/Stop tans…" sodat jy weet iets gebeur.

## Byvoeging en verwydering van dienste

- **Voeg diens by** (bo-aan die Dienste-afdeling) laat jou enigiets byvoeg wat jy
  nie tydens die opstelling gekies het nie, gegroepeer volgens kategorie sodat dit
  maklik is om te vind.
- Om ’n diens te verwyder, maak sy **⋯-kieslys → Konfigureer** oop.

Beide hier en op die kontroleskerm word dienste volgens kategorie gegroepeer
(mediabedieners, mediabestuur, aflaaikliënte, ensovoorts).

## Hou dienste op datum

- Ensembler kontroleer stilweg op die agtergrond, so beskikbare opdaterings
  verskyn vanself. Jy kan ook op **Kontroleer vir opdaterings** klik (bo-aan die
  Dienste-afdeling) om alles nou te kontroleer, of een diens kontroleer via sy
  **⋯-kieslys → Kontroleer vir opdaterings** (die resultaat wys op die kaart).
- Wanneer opdaterings beskikbaar is, wys die Dienste-kop hoeveel, en ’n
  **Dateer alles op**-knoppie pas hulle in een slag toe. Om net een op te
  dateer, klik **Opdatering beskikbaar — dateer nou op** op sy kaart. Jou
  instellings word behou.
- **Sit ’n weergawe vas.** Standaard volg elke diens die nuutste weergawe. Om
  een aan ’n spesifieke weergawe vas te hou, maak **⋯-kieslys → Konfigureer** oop
  en kies uit die **Weergawe**-aftrekkieslys. Vasgesitte dienste wys ’n 🔒 en hou
  op om opdaterings aan te bied.
- **Outomatiese opdaterings.** Skakel **Instellings → Algemeen → Installeer
  opdaterings outomaties** aan om Ensembler beskikbare opdaterings op die
  agtergrond te laat toepas. Dit is standaard af, sodat jy in beheer bly.

## Instellings

Maak **Instellings** (regs bo) oop vir toepassingswye opsies, georganiseer in
afdelings:

- **Voorkoms** — tema (Lig, Donker, of Stelsel) en taal.
- **Algemeen** — hou Ensembler in die kieslysbalk / stelsellaai wanneer jy die
  venster toemaak (standaard aan; jou dienste loop hoe dan ook voort — gebruik
  **Sluit af** in die laai-kieslys om heeltemal uit te gaan), installeer
  diensopdaterings outomaties (standaard af), en jou tydsone.
- **Gevorderd** — tegniese besonderhede wat jy normaalweg nie nodig sal hê nie:
  diagnostiek (of Docker loop, hoeveel dienste aan is), vrye skyf en geheue, en
  die gebruiker-/groep-ID’s wat vir lêertoestemmings gebruik word.
- **Terugstel → Stel alles terug** — stop en verwyder alle dienste en hul
  instellings, en keer Ensembler terug na ’n vars installasie. **Jou medialêers
  word nooit aangeraak nie** — net die dienste en hul konfigurasie word verwyder.

## Waar jou instellings woon

Ensembler stoor sy konfigurasie in ’n verborge per-gebruiker-vouer (vir jou
bestuur — jy behoort dit nie te hoef te wysig nie):

- **macOS:** `~/Library/Application Support/Ensembler`
- **Windows:** `%APPDATA%\Ensembler`
- **Linux:** `~/.config/Ensembler`

Jou **medialêers** (TV, flieks, aflaaie) woon waar ook al jy tydens die
opstelling gekies het en is apart hiervan.

## Diagnostiek

Tegniese status — of Docker loop, hoeveel dienste aan is, en hoeveel skyf en
geheue vry is — woon onder **Instellings → Gevorderd**. Jy sal dit normaalweg
nie nodig hê nie, maar dit is handig wanneer jy probleme oplos.

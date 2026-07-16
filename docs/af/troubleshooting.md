# Probleemoplossing

## "Docker word vereis" / Docker loop nie
Ensembler benodig ’n houer-looptyd wat loop. As jy **Docker Desktop** gebruik,
begin dit en wag totdat dit rapporteer dat dit loop (nie net geïnstalleer nie),
en Ensembler sal voortgaan. As dit nie geïnstalleer is nie, volg die
aflaaiskakel op daardie skerm. Gebruik jy ’n alternatief soos **OrbStack** of
**Podman**? Dit is ook goed — maak net seker dit loop en dat `docker` en
`docker compose` werk.

## ’n Diens wil nie begin nie
- Maak die diens se **⋯-kieslys → Bekyk logboeke** oop om te sien waaroor dit kla.
- Probeer **⋯-kieslys → Herbegin**.
- Invoerkennisgewings en biblioteekskanderings kan ’n minuut neem terwyl dienste
  klaar begin, so gee dit ’n oomblik na die eerste begin.

## ’n Waarskuwing oor Docker-geheue of skyfspasie
Ensembler waarsku wanneer Docker min geheue toegewys het of die mediaskyf byna
vol is — die twee mees algemene, onsigbare redes waarom dienste sleg optree.
- **Geheue:** verhoog dit in jou houer-looptyd se instellings (Docker Desktop →
  Settings → Resources); 4 GB of meer is ’n goeie basislyn vir ’n paar dienste.
- **Skyf:** maak spasie vry op die skyf wat jou aflaaie/media gebruik, of wys
  dienste na ’n groter skyf vanaf hul **Konfigureer**-skerm.

## "Not Secure"-waarskuwing wanneer ek ’n diens oopmaak
Dienste maak nou **binne Ensembler** as oortjies oop, so jy behoort dit nie te
sien nie. Dit verskyn net as jy ’n diens se **⋯-kieslys → Maak in blaaier oop**
gebruik (of Ensembler in ’n webblaaier laat loop). Plaaslike dienste loop oor
`http://localhost`, wat blaaiers as "Not Secure" bestempel — vir ’n diens op jou
eie masjien is dit verwag en onskadelik; jou data verlaat nie jou rekenaar nie.

## ’n Poort is reeds in gebruik
Ensembler kontroleer poorte tydens die opstelling en kies outomaties ’n vrye een
as ’n verstek geneem is, so dit is skaars. As ’n diens steeds nie wil bind nie,
het ’n ander toepassing dalk sy poort gegryp — stop daardie toepassing, of
verander die poort vanaf die diens se **Konfigureer**-skerm.

## Waar is my data?
- **Toepassingskonfigurasie** woon in ’n verborge per-gebruiker-vouer (sien
  *Bestuur van jou dienste → Waar jou instellings woon*). Jy hoef dit nie te
  wysig nie.
- **Jou media** bly waar ook al jy tydens die opstelling gekies het en word nooit
  deur Ensembler geskuif of uitgevee nie.

## Iets is erg vasgevang — begin vars
**Instellings → Terugstel → Stel alles terug** stop en verwyder alle dienste en
hul instellings en keer Ensembler terug na ’n skoon toestand. **Jou medialêers
word nie geraak nie** — net dienste en hul konfigurasie word verwyder. Jy sal
daarna weer deur die opstellingassistent gaan.

## Steeds vasgevang?
Kry die besonderhede vanaf ’n diens se **Bekyk logboeke** en vanaf **Instellings
→ Gevorderd → Diagnostiek** — daardie is die nuttigste dinge om in te sluit
wanneer jy ’n probleem rapporteer.

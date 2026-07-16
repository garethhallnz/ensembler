# Hoe om Ensembler op te dateer

Hierdie bladsy gaan oor die opdatering van **Ensembler self** — die toepassing.
(Om jou *dienste* soos Sonarr en Plex op datum te hou, sien **Bestuur van
dienste → Hou dienste op datum**.)

## Hoe jy sal weet daar is ’n opdatering

Ensembler kontroleer nou en dan of ’n nuwer weergawe vrygestel is, en wys ’n
klein kennisgewing op die kontroleskerm wanneer een beskikbaar is. Jy kan ook
enige tyd kontroleer by **Instellings → Algemeen → Kontroleer vir opdaterings**.

Ensembler installeer nooit self ’n nuwe weergawe nie — opdatering is ’n vinnige
handmatige stap, en dit werk dieselfde op elke platform: **laai die nuutste
weergawe af en maak dit oop**. Jou dienste en instellings word heeltemal
onaangeraak gelaat.

## Opdatering

1. Maak die **[Vrystellings-bladsy](https://github.com/garethhallnz/ensembler/releases)**
   oop (die opdateringkennisgewing skakel reguit daarheen).
2. Laai die lêer vir jou stelsel af en installeer dit dan oor jou huidige kopie:

   - **macOS** — laai die `.dmg` af, maak dit oop, en sleep **Ensembler** na jou
     **Applications**-vouer om die ou een te vervang. Die eerste keer wat jy die
     nuwe weergawe oopmaak, regskliek (of Control-klik) op die toepassing en kies
     **Open**.
   - **Windows** — laai die `.exe` af en laat dit loop. Dit installeer oor jou
     bestaande weergawe. As Windows ’n "Windows protected your PC"-skerm wys,
     klik **More info → Run anyway**.
   - **Linux** — laai die nuwe `.AppImage` af en vervang die ou een. Jy sal dalk
     moet dit weer as uitvoerbaar merk (regskliek → **Properties →
     Permissions**, of `chmod +x` in ’n terminaal).

3. Maak Ensembler oop. Dis al — jou dienste bly deurgaans loop, en al jou
   instellings is presies soos jy dit gelaat het.

## Skakel die kennisgewing af

As jy liewer nie opdateringkennisgewings wil sien nie, skakel **Instellings →
Algemeen → Opdateringkennisgewings** af. Jy kan steeds enige tyd handmatig
kontroleer met die **Kontroleer vir opdaterings**-knoppie.

> **Waarom opdatering handmatig is:** dit hou Ensembler eenvoudig en konsekwent
> oor macOS, Windows en Linux, en beteken die toepassing verander nooit self
> agter jou rug om nie. Jou medialêers word nooit deur ’n opdatering geraak nie.

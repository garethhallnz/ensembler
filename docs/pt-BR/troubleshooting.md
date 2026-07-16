# Solução de problemas

## "É necessário o Docker" / Docker não está em execução
O Ensembler precisa de um runtime de contêineres em execução. Se você usa o
**Docker Desktop**, inicie-o e aguarde até que ele informe que está em execução
(não apenas instalado), e o Ensembler continuará. Se não estiver instalado, siga
o link de download naquela tela. Usa uma alternativa como **OrbStack** ou
**Podman**? Também tudo bem — apenas certifique-se de que esteja em execução e de
que `docker` e `docker compose` funcionem.

## Um serviço não inicia
- Abra o **menu ⋯ → Ver logs** do serviço para ver do que ele está reclamando.
- Tente **menu ⋯ → Reiniciar**.
- Notificações de importação e varreduras de biblioteca podem levar um minuto
  enquanto os serviços terminam de iniciar, então dê um momento após a primeira
  execução.

## Um aviso sobre memória do Docker ou espaço em disco
O Ensembler avisa quando o Docker tem pouca memória alocada ou quando o disco de
mídia está quase cheio — os dois motivos mais comuns e invisíveis para os
serviços se comportarem mal.
- **Memória:** aumente-a nas configurações do seu runtime de contêineres
  (Docker Desktop → Settings → Resources); 4 GB ou mais é uma boa base para
  alguns serviços.
- **Disco:** libere espaço na unidade que seus downloads/mídia usam, ou aponte
  os serviços para uma unidade maior a partir da tela **Configurar** deles.

## Aviso de "Não seguro" ao abrir um serviço
Os serviços agora abrem **dentro do Ensembler** como abas, então você não deve
ver isso. Isso só aparece se você usar o **menu ⋯ → Abrir no navegador** de um
serviço (ou executar o Ensembler em um navegador web). Os serviços locais rodam
sobre `http://localhost`, que os navegadores rotulam como "Não seguro" — para um
serviço na sua própria máquina isso é esperado e inofensivo; seus dados não estão
saindo do seu computador.

## Uma porta já está em uso
O Ensembler verifica as portas durante a configuração e escolhe automaticamente
uma livre caso uma padrão esteja ocupada, então isso é raro. Se um serviço ainda
assim não conseguir vincular-se, outro aplicativo pode ter tomado sua porta —
pare esse aplicativo, ou altere a porta a partir da tela **Configurar** do
serviço.

## Onde estão meus dados?
- A **configuração do aplicativo** fica em uma pasta oculta por usuário (veja
  *Gerenciando seus serviços → Onde ficam suas configurações*). Você não precisa
  editá-la.
- Sua **mídia** permanece onde quer que você tenha escolhido durante a
  configuração e nunca é movida ou excluída pelo Ensembler.

## Algo está seriamente travado — começar do zero
**Configurações → Redefinir → Redefinir tudo** para e remove todos os
serviços e suas configurações e retorna o Ensembler a um estado limpo. **Seus
arquivos de mídia não são afetados** — apenas os serviços e sua configuração são
removidos. Depois você passará novamente pelo assistente de configuração.

## Ainda travado?
Pegue os detalhes de **Ver logs** de um serviço e de **Configurações → Avançado
→ Diagnósticos** — essas são as coisas mais úteis para incluir ao relatar um
problema.

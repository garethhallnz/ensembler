# Como atualizar o Ensembler

Esta página é sobre atualizar o **próprio Ensembler** — o app. (Para manter seus
*serviços* como Sonarr e Plex atualizados, consulte **Gerenciar serviços →
Mantendo os serviços atualizados**.)

## Como você vai saber que há uma atualização

O Ensembler verifica de tempos em tempos se uma versão mais recente foi lançada e
mostra um pequeno aviso no painel quando há uma disponível. Você também pode
verificar a qualquer momento em **Configurações → Geral → Verificar
atualizações**.

O Ensembler nunca instala uma nova versão por conta própria — atualizar é um passo
manual rápido, e a ideia é a mesma em todas as plataformas: **baixe a versão mais
recente e abra-a**. Seus serviços e configurações ficam completamente intactos.

## Atualizando

1. Abra a **[página de Releases](https://github.com/garethhallnz/ensembler/releases)**
   (o aviso de atualização leva direto para lá).
2. Baixe o arquivo do seu sistema e instale-o sobre a sua cópia atual:

   - **macOS** — baixe o `.dmg`, abra-o e arraste o **Ensembler** para a sua pasta
     **Aplicativos**, substituindo o antigo. Na primeira vez que você abrir a nova
     versão, clique com o botão direito (ou Control-clique) no app e escolha
     **Abrir**.
   - **Windows** — baixe o `.exe` e execute-o. Ele é instalado sobre a sua versão
     existente. Se o Windows mostrar uma tela "O Windows protegeu o seu PC", clique
     em **Mais informações → Executar assim mesmo**.
   - **Linux** — baixe o novo `.AppImage` e substitua o antigo. Talvez você precise
     marcá-lo como executável novamente (clique com o botão direito → **Propriedades
     → Permissões**, ou `chmod +x` em um terminal).

3. Abra o Ensembler. É isso — seus serviços continuam em execução o tempo todo, e
   todas as suas configurações estão exatamente como você as deixou.

## Desativando o aviso

Se você preferir não ver avisos de atualização, desative **Configurações → Geral →
Notificações de atualização**. Você ainda pode verificar manualmente quando quiser
com o botão **Verificar atualizações**.

> **Por que a atualização é manual:** isso mantém o Ensembler simples e consistente
> no macOS, no Windows e no Linux, e significa que o app nunca se altera pelas suas
> costas. Seus arquivos de mídia nunca são afetados por uma atualização.

# Smoke test do multiplayer (Supabase)

Este roteiro serve para garantir rapidamente que o schema do Supabase e a nova lógica multiplayer estão funcionando antes de abrir o jogo para os usuários. O objetivo é **criar uma sala temporária**, registrar o host como jogador, gravar um palpite e ler os dados de volta; em seguida, tudo é limpo automaticamente.

## Pré-requisitos

1. Schema do Supabase já provisionado (rode `schemaMulti.sql` no SQL Editor do seu projeto).
2. Uma conta/profile válida no Supabase para servir como host de teste. Anote o `id` dessa entrada em `public.profiles` (formato UUID).
3. Ambiente local com Python 3.11 (já usado no projeto) e a biblioteca `requests` instalada:
   ```bash
   pip install requests
   ```

## Variáveis de ambiente

Configure as variáveis abaixo antes de rodar o script:

| Variável               | Descrição                                                                                               |
|------------------------|-----------------------------------------------------------------------------------------------------------|
| `SUPABASE_URL`         | URL do projeto (ex.: `https://xxxx.supabase.co`).                                                        |
| `SUPABASE_SERVICE_KEY` | **Service role key** do Supabase. Necessária para sobrescrever as políticas RLS durante o teste.        |
| `SMOKE_PROFILE_ID`     | UUID de um registro existente em `public.profiles` (será o host temporário).                            |

> ⚠️ Use uma conta de teste; o script atualiza e exclui registros criados durante o processo.

## Execução

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ...service-role..."
export SMOKE_PROFILE_ID="00000000-0000-0000-0000-000000000000"

python scripts/smoke_multiplayer.py
```

A saída esperada é parecida com:

```
Iniciando smoke test do multiplayer...
[ok] Sala criada com código QWERTY
[ok] Player registrado (id=...)
[ok] Palpite salvo (id=...)
[ok] Leitura funcionou (1 palpites encontrados)
Smoke test finalizado com sucesso!
[ok] Sala temporária removida
```

Em caso de falha, o script retorna código `1` e imprime no `stderr` qual etapa quebrou (por exemplo, falta de permissões, erro de RLS ou problemas no schema). Corrija o problema apontado, rerode o script e só depois libere o modo multiplayer para os usuários reais.

## O que o teste cobre

1. **Escrita** em `multiplayer_rooms`.
2. **Escrita** em `multiplayer_players`.
3. **Escrita/Leitura** em `multiplayer_guesses`.
4. **Políticas RLS / triggers** (usa o service key, garantindo que o schema responde corretamente).
5. **Limpeza**: remove a sala criada para não deixar dados órfãos.

Esse teste não inicia rounds reais nem interage com o frontend; ele valida a infraestrutura básica do banco. Para um teste completo, ainda é recomendável abrir duas sessões no `/multiplayer`, criar/entrar na sala e jogar uma rodada real.

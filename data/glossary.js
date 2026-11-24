/* =========================================================
   Tecnologia para Todos — Glossário de Palavras
   ---------------------------------------------------------
   Cada palavra tem:
     term     → a palavra/comando
     emoji    → ícone
     category → Comandos | Variáveis | Decisões | Listas | Repetição | Geral
     simple   → explicação em linguagem simples
     example  → (opcional) código de exemplo
     output   → (opcional) saída do exemplo
     tr       → tradução { es: espanhol, en: inglês, fr: francês }
     lesson   → número da aula em que aparece
   ========================================================= */

window.TPT_GLOSSARY = [
  // ---------------- Geral ----------------
  {
    term: 'Python', emoji: '🐍', category: 'Geral', lesson: 1,
    simple: 'Uma linguagem de programação: um jeito de escrever instruções que o computador entende. É uma das mais fáceis para começar.',
    tr: { es: 'Python (lenguaje)', en: 'Python (language)', fr: 'Python (langage)' },
  },
  {
    term: 'código', emoji: '📜', category: 'Geral', lesson: 1,
    simple: 'O texto com as instruções que você escreve para o computador. O computador lê de cima para baixo, uma linha de cada vez.',
    tr: { es: 'código', en: 'code', fr: 'code' },
  },
  {
    term: 'programa', emoji: '🧠', category: 'Geral', lesson: 1,
    simple: 'Um conjunto de instruções que faz alguma tarefa. Ex.: uma calculadora ou uma lista de compras.',
    tr: { es: 'programa', en: 'program', fr: 'programme' },
  },
  {
    term: 'console / terminal', emoji: '🖥️', category: 'Geral', lesson: 1,
    simple: 'A tela escura onde aparecem as respostas do programa (o que o print mostra) e onde você digita no input.',
    tr: { es: 'consola / terminal', en: 'console / terminal', fr: 'console / terminal' },
  },
  {
    term: 'erro (bug)', emoji: '🐞', category: 'Geral', lesson: 1,
    simple: 'Quando o Python não entende o código ou algo dá errado. Normal e faz parte! A mensagem de erro mostra a linha do problema.',
    example: 'Print("Oi")',
    output: 'NameError: o Python não conhece "Print"',
    tr: { es: 'error (bug)', en: 'error (bug)', fr: 'erreur (bug)' },
  },
  {
    term: 'comentário #', emoji: '📝', category: 'Geral', lesson: 1,
    simple: 'Uma anotação para pessoas, não para o computador. Tudo depois do # é ignorado pelo Python.',
    example: '# Isto é um comentário\nprint("Oi")  # mostra Oi',
    output: 'Oi',
    tr: { es: 'comentario', en: 'comment', fr: 'commentaire' },
  },
  {
    term: 'indentação (espaços)', emoji: '↔️', category: 'Geral', lesson: 1,
    simple: 'Os 4 espaços no começo da linha. Mostram o que está “dentro” de um if, for ou while. No Python, os espaços são obrigatórios!',
    example: 'if 10 > 5:\n    print("Dentro do if")\nprint("Fora do if")',
    output: 'Dentro do if\nFora do if',
    tr: { es: 'sangría', en: 'indentation', fr: 'indentation' },
  },

  // ---------------- Comandos ----------------
  {
    term: 'print()', emoji: '🖨️', category: 'Comandos', lesson: 1,
    simple: 'Mostra uma mensagem na tela (no console). Textos ficam entre aspas.',
    example: 'print("Olá, mundo!")',
    output: 'Olá, mundo!',
    tr: { es: 'imprimir / mostrar', en: 'print', fr: 'afficher' },
  },
  {
    term: 'input()', emoji: '⌨️', category: 'Comandos', lesson: 1,
    simple: 'Faz uma pergunta e espera a pessoa digitar. A resposta sempre chega como texto.',
    example: 'nome = input("Seu nome? ")\nprint("Olá,", nome)',
    output: 'Seu nome? Ana\nOlá, Ana',
    tr: { es: 'entrada', en: 'input', fr: 'entrée / saisie' },
  },
  {
    term: 'int()', emoji: '🔢', category: 'Comandos', lesson: 1,
    simple: 'Transforma um texto em número inteiro (sem vírgula). Use com input para fazer contas.',
    example: 'idade = int("25")\nprint(idade + 1)',
    output: '26',
    tr: { es: 'entero', en: 'integer', fr: 'entier' },
  },
  {
    term: 'float()', emoji: '📏', category: 'Comandos', lesson: 1,
    simple: 'Transforma um texto em número decimal (com ponto). Atenção: use ponto, não vírgula: 5.50',
    example: 'preco = float("5.50")\nprint(preco * 2)',
    output: '11.0',
    tr: { es: 'decimal', en: 'float (decimal)', fr: 'décimal' },
  },

  // ---------------- Variáveis ----------------
  {
    term: 'variável', emoji: '📦', category: 'Variáveis', lesson: 1,
    simple: 'Uma caixa com nome que guarda um valor. O sinal = coloca o valor dentro da caixa.',
    example: 'nome = "Ana"\nidade = 25\nprint(nome, idade)',
    output: 'Ana 25',
    tr: { es: 'variable', en: 'variable', fr: 'variable' },
  },
  {
    term: 'str (texto)', emoji: '🔤', category: 'Variáveis', lesson: 1,
    simple: 'Tipo de valor que é texto. Sempre fica entre aspas: "Ana", "123", "Olá!".',
    example: 'cidade = "Joinville"\nprint(cidade)',
    output: 'Joinville',
    tr: { es: 'cadena de texto', en: 'string', fr: 'chaîne de caractères' },
  },
  {
    term: 'aspas " "', emoji: '💬', category: 'Variáveis', lesson: 1,
    simple: 'Marcam o começo e o fim de um texto. Com aspas é texto, sem aspas o Python acha que é variável ou número.',
    example: 'print("2 + 3")\nprint(2 + 3)',
    output: '2 + 3\n5',
    tr: { es: 'comillas', en: 'quotes', fr: 'guillemets' },
  },
  {
    term: '= (atribuição)', emoji: '➡️', category: 'Variáveis', lesson: 1,
    simple: 'Um sinal de igual guarda um valor na variável. Não é para comparar! Para comparar use ==.',
    example: 'pontos = 10\npontos = pontos + 5\nprint(pontos)',
    output: '15',
    tr: { es: 'asignación', en: 'assignment', fr: 'affectation' },
  },

  // ---------------- Decisões ----------------
  {
    term: 'if', emoji: '🔀', category: 'Decisões', lesson: 1,
    simple: 'Quer dizer “se”. Testa uma condição: se for verdade, faz o que está dentro (com espaços).',
    example: 'idade = 20\nif idade >= 18:\n    print("Maior de idade")',
    output: 'Maior de idade',
    tr: { es: 'si', en: 'if', fr: 'si' },
  },
  {
    term: 'else', emoji: '↩️', category: 'Decisões', lesson: 1,
    simple: 'Quer dizer “senão”. É o que acontece quando a condição do if não é verdadeira.',
    example: 'idade = 15\nif idade >= 18:\n    print("Maior")\nelse:\n    print("Menor")',
    output: 'Menor',
    tr: { es: 'si no / sino', en: 'else', fr: 'sinon' },
  },
  {
    term: 'elif', emoji: '🚦', category: 'Decisões', lesson: 1,
    simple: 'Junção de “else if”: “senão, se…”. Serve para testar mais uma opção.',
    example: 'nota = 6\nif nota >= 7:\n    print("Aprovado")\nelif nota >= 5:\n    print("Recuperação")',
    output: 'Recuperação',
    tr: { es: 'si no, si', en: 'else if', fr: 'sinon si' },
  },
  {
    term: 'comparações == != > <', emoji: '⚖️', category: 'Decisões', lesson: 1,
    simple: '== igual · != diferente · > maior · < menor · >= maior ou igual · <= menor ou igual. A resposta é True (verdade) ou False (falso).',
    example: 'print(5 == 5)\nprint(3 > 10)',
    output: 'True\nFalse',
    tr: { es: 'comparaciones', en: 'comparisons', fr: 'comparaisons' },
  },
  {
    term: 'and / or', emoji: '🔗', category: 'Decisões', lesson: 1,
    simple: 'and (“e”): as duas condições precisam ser verdade. or (“ou”): basta uma ser verdade.',
    example: 'dia = "domingo"\nif dia == "sábado" or dia == "domingo":\n    print("Fim de semana")',
    output: 'Fim de semana',
    tr: { es: 'y / o', en: 'and / or', fr: 'et / ou' },
  },
  {
    term: 'True / False', emoji: '✅', category: 'Decisões', lesson: 1,
    simple: 'Verdadeiro e Falso. São as respostas de uma pergunta (condição). Escreva com a primeira letra maiúscula.',
    example: 'print(10 > 5)',
    output: 'True',
    tr: { es: 'Verdadero / Falso', en: 'True / False', fr: 'Vrai / Faux' },
  },

  // ---------------- Listas ----------------
  {
    term: 'lista [ ]', emoji: '🧺', category: 'Listas', lesson: 2,
    simple: 'Uma variável que guarda vários valores em ordem. Usa colchetes [ ] e vírgulas entre os itens.',
    example: 'frutas = ["maçã", "banana", "uva"]\nprint(frutas)',
    output: "['maçã', 'banana', 'uva']",
    tr: { es: 'lista', en: 'list', fr: 'liste' },
  },
  {
    term: 'índice [0]', emoji: '🔢', category: 'Listas', lesson: 2,
    simple: 'A posição de um item na lista. A contagem começa no 0! O [-1] é o último item.',
    example: 'frutas = ["maçã", "banana", "uva"]\nprint(frutas[0])\nprint(frutas[-1])',
    output: 'maçã\nuva',
    tr: { es: 'índice / posición', en: 'index', fr: 'indice / position' },
  },
  {
    term: 'append()', emoji: '➕', category: 'Listas', lesson: 2,
    simple: 'Adiciona um item novo no final da lista. Quer dizer “anexar, acrescentar”.',
    example: 'compras = ["arroz"]\ncompras.append("café")\nprint(compras)',
    output: "['arroz', 'café']",
    tr: { es: 'añadir', en: 'append (add)', fr: 'ajouter' },
  },
  {
    term: 'remove()', emoji: '➖', category: 'Listas', lesson: 2,
    simple: 'Tira um item da lista procurando pelo valor (o nome do item). Se o item não existir, dá erro.',
    example: 'compras = ["arroz", "café"]\ncompras.remove("arroz")\nprint(compras)',
    output: "['café']",
    tr: { es: 'quitar / eliminar', en: 'remove', fr: 'retirer / supprimer' },
  },
  {
    term: 'len()', emoji: '📏', category: 'Listas', lesson: 2,
    simple: 'Conta quantos itens tem na lista (ou quantas letras tem um texto). Vem de “length” = tamanho.',
    example: 'compras = ["arroz", "feijão", "café"]\nprint(len(compras))\nprint(len("Ana"))',
    output: '3\n3',
    tr: { es: 'longitud / tamaño', en: 'length', fr: 'longueur / taille' },
  },
  {
    term: 'in', emoji: '🔎', category: 'Listas', lesson: 2,
    simple: 'Pergunta se um item está dentro da lista. A resposta é True ou False. No for, significa “em”.',
    example: 'compras = ["arroz", "café"]\nprint("café" in compras)',
    output: 'True',
    tr: { es: 'en / dentro de', en: 'in', fr: 'dans' },
  },

  // ---------------- Repetição ----------------
  {
    term: 'for', emoji: '🔁', category: 'Repetição', lesson: 2,
    simple: 'Repete as linhas de dentro “para cada” item de uma lista (ou de um range). Use quando sabe quantas vezes repetir.',
    example: 'for fruta in ["maçã", "uva"]:\n    print("Eu gosto de", fruta)',
    output: 'Eu gosto de maçã\nEu gosto de uva',
    tr: { es: 'para (cada)', en: 'for (each)', fr: 'pour (chaque)' },
  },
  {
    term: 'range()', emoji: '🪜', category: 'Repetição', lesson: 2,
    simple: 'Cria uma sequência de números para o for. range(1, 4) gera 1, 2, 3 — o último número não entra!',
    example: 'for n in range(1, 4):\n    print(n)',
    output: '1\n2\n3',
    tr: { es: 'rango', en: 'range', fr: 'plage / intervalle' },
  },
  {
    term: 'while', emoji: '🔄', category: 'Repetição', lesson: 2,
    simple: 'Quer dizer “enquanto”. Repete enquanto a condição for verdadeira. Cuidado para não repetir para sempre!',
    example: 'contador = 1\nwhile contador <= 3:\n    print(contador)\n    contador = contador + 1',
    output: '1\n2\n3',
    tr: { es: 'mientras', en: 'while', fr: 'tant que' },
  },
  {
    term: 'loop (repetição)', emoji: '🎠', category: 'Repetição', lesson: 2,
    simple: 'Quando um pedaço do código se repete várias vezes. O for e o while criam loops. “Loop infinito” é quando nunca para.',
    tr: { es: 'bucle', en: 'loop', fr: 'boucle' },
  },

  // ---------------- Bibliotecas ----------------
  {
    term: 'import', emoji: '📦', category: 'Bibliotecas', lesson: 3,
    simple: 'Comando usado no início do código para trazer bibliotecas prontas para o seu programa.',
    example: 'import random\nprint(random.randint(1, 6))',
    output: '4',
    tr: { es: 'importar', en: 'import', fr: 'importer' },
  },
  {
    term: 'biblioteca / módulo', emoji: '🧰', category: 'Bibliotecas', lesson: 3,
    simple: 'Um pacote com funções e ferramentas prontas que já existem no Python (como random, time, math e datetime).',
    tr: { es: 'biblioteca / módulo', en: 'library / module', fr: 'bibliothèque / module' },
  },
  {
    term: 'random', emoji: '🎲', category: 'Bibliotecas', lesson: 3,
    simple: 'Biblioteca para gerar números aleatórios, fazer sorteios e embaralhar listas.',
    example: 'import random\nprint(random.randint(1, 10))',
    output: '7',
    tr: { es: 'aleatorio', en: 'random', fr: 'aléatoire' },
  },
  {
    term: 'random.randint()', emoji: '🎯', category: 'Bibliotecas', lesson: 3,
    simple: 'Sorteia um número inteiro entre dois limites, incluindo o primeiro e o último número.',
    example: 'import random\ndado = random.randint(1, 6)\nprint("Dado:", dado)',
    output: 'Dado: 5',
    tr: { es: 'entero aleatorio', en: 'random integer', fr: 'entier aléatoire' },
  },
  {
    term: 'random.choice()', emoji: '🍀', category: 'Bibliotecas', lesson: 3,
    simple: 'Escolhe aleatoriamente um item de dentro de uma lista.',
    example: 'import random\nnomes = ["Ana", "Leo", "Bia"]\nprint(random.choice(nomes))',
    output: 'Leo',
    tr: { es: 'elección aleatoria', en: 'random choice', fr: 'choix aléatoire' },
  },
  {
    term: 'time.sleep()', emoji: '⏱️', category: 'Bibliotecas', lesson: 3,
    simple: 'Pausa a execução do programa por uma quantidade de segundos (pode usar decimais, como 0.5).',
    example: 'import time\nprint("3...")\ntime.sleep(1)\nprint("Já!")',
    output: '3...\nJá!',
    tr: { es: 'pausar / esperar', en: 'sleep / pause', fr: 'pause / attendre' },
  },
  {
    term: 'math', emoji: '🧮', category: 'Bibliotecas', lesson: 3,
    simple: 'Biblioteca de matemática com funções como sqrt() (raiz quadrada), ceil(), floor() e a constante pi.',
    example: 'import math\nprint(math.sqrt(25))',
    output: '5.0',
    tr: { es: 'matemáticas', en: 'math', fr: 'mathématiques' },
  },
  {
    term: 'datetime', emoji: '📅', category: 'Bibliotecas', lesson: 3,
    simple: 'Biblioteca para trabalhar com datas e horários atuais no programa.',
    example: 'from datetime import datetime\nprint(datetime.now().strftime("%d/%m/%Y"))',
    output: '23/11/2026',
    tr: { es: 'fecha y hora', en: 'date and time', fr: 'date et heure' },
  },
];

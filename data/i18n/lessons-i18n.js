/* =========================================================
   Tecnologia para Todos — Traduções da Trilha de Aulas (ES/EN)
   ---------------------------------------------------------
   O português (PT) fica no arquivo base data/lessons.js.
   Este arquivo fornece as traduções em Espanhol (es) e Inglês (en)
   indexadas por ID da aula e ID do card.
   ========================================================= */
(function (root) {
  'use strict';

  root.TPT_LESSONS_I18N = {
    es: {
      lessons: {
        'aula-1': {
          title: 'Primeros Pasos',
          subtitle: 'print · input · variables · if/else',
          topics: [
            { name: 'print', desc: 'Mostrar en pantalla' },
            { name: 'input', desc: 'Recibir datos' },
            { name: 'variables', desc: 'Guardar valores' },
            { name: 'if / else', desc: 'Tomar decisiones' },
          ],
        },
        'aula-2': {
          title: 'Listas y Repeticiones',
          subtitle: 'listas · índices · append · remove · len · for · while',
          topics: [
            { name: 'listas [ ]', desc: 'Guardar varias cosas' },
            { name: 'índices', desc: 'La posición de cada ítem' },
            { name: 'for', desc: 'Repetir para cada ítem' },
            { name: 'while', desc: 'Repetir mientras sea verdad' },
          ],
        },
      },
      cards: {
        'a1-python': {
          tag: 'Introducción',
          title: '¿Qué es Python?',
          text: 'Un lenguaje para darle instrucciones a la computadora, paso a paso.',
          tip: 'La computadora lee el código de arriba hacia abajo, una línea a la vez.',
        },
        'a1-onde': {
          tag: 'Herramienta',
          title: 'Dónde vamos a programar',
          text: 'Aquí mismo, en el Playground de este sitio — funciona en el celular y en la computadora, sin instalar nada.',
          items: [
            { label: 'Escribe el código', text: 'En el editor (lado izquierdo)' },
            { label: 'Haz clic en Ejecutar Código', text: 'Para correr el programa' },
            { label: 'Mira el resultado', text: 'En la Consola (lado derecho)' },
          ],
          tip: 'En casa también puedes usar VS Code con Python instalado (python.org → marca “Add Python to PATH”).',
        },
        'a1-print': {
          tag: 'print',
          title: 'print: mostrar en pantalla',
          tip: 'El texto siempre va entre comillas.',
        },
        'a1-print-varios': {
          tag: 'print',
          title: 'print con varios elementos',
          tip: 'La coma separa los elementos y Python coloca un espacio entre ellos.',
        },
        'a1-print-contas': {
          tag: 'print',
          title: 'Cálculos y texto',
          tip: 'Sin comillas, Python hace la cuenta. ¡Con comillas, es solo texto!',
        },
        'a1-comentario': {
          tag: 'comentario',
          title: 'Comentario (#)',
          tip: 'Todo lo que va después de # Python lo ignora. Sirve para hacer anotaciones.',
        },
        'a1-desafio-1': {
          tag: 'Desafío 1',
          title: 'Desafío 1',
          items: [
            { label: 'Muestra tu nombre' },
            { label: 'Muestra tu país' },
            { label: 'Muestra una frase sobre ti' },
          ],
        },
        'a1-variaveis': {
          tag: 'variables',
          title: 'Variables: cajas con nombre',
          items: [
            { label: 'nome', text: 'guarda un texto' },
            { label: 'idade', text: 'guarda un número' },
          ],
          tip: 'El signo = guarda el valor dentro de la caja (variable).',
        },
        'a1-tipos': {
          tag: 'variables',
          title: 'Tipos de variables',
          items: [
            { label: 'str', text: 'texto, entre comillas' },
            { label: 'int', text: 'número sin coma decimal' },
            { label: 'float', text: 'número con punto decimal' },
          ],
          tip: 'El texto va entre comillas. El número no. Los decimales usan punto, no coma: 1.75',
        },
        'a1-regras': {
          tag: 'variables',
          title: 'Reglas de las variables',
          tip: 'Sin espacios en el nombre, no empieces con un número y recuerda: la caja guarda el último valor.',
        },
        'a1-input': {
          tag: 'input',
          title: 'input: recibir datos',
          tip: 'Lo que la persona escribe queda guardado en una variable.',
        },
        'a1-input-texto': {
          tag: 'input',
          title: 'input devuelve texto',
          tip: 'Para números, usa int() o float() alrededor de input.',
        },
        'a1-soma': {
          tag: 'input',
          title: 'Calculadora de suma',
          tip: 'int(input(...)) transforma lo que escribiste en un número.',
        },
        'a1-if': {
          tag: 'if / else',
          title: 'if / else: tomar decisiones',
          items: [
            { label: '==', text: 'igual' },
            { label: '!=', text: 'diferente' },
            { label: '>', text: 'mayor' },
            { label: '<', text: 'menor' },
            { label: '>=', text: 'mayor o igual' },
            { label: '<=', text: 'menor o igual' },
          ],
          tip: 'Dos puntos (:) al final y 4 espacios al comienzo de la línea de adentro.',
        },
        'a1-elif': {
          tag: 'if / else',
          title: 'elif: más de una opción',
          items: [
            { label: 'if', text: 'prueba primero' },
            { label: 'elif', text: 'si no, prueba esta' },
            { label: 'else', text: 'si ninguna se cumplió' },
          ],
          tip: 'Python se detiene en la primera condición verdadera.',
        },
        'a1-and-or': {
          tag: 'if / else',
          title: 'and y or: unir condiciones',
          items: [
            { label: 'and', text: 'ambas deben ser verdaderas' },
            { label: 'or', text: 'basta con que una sea verdadera' },
          ],
          tip: '¡Cambia los valores de idade y dia en el Playground y mira qué pasa!',
        },
        'a1-cuidado': {
          tag: 'Atención',
          title: 'Cuidado con estos detalles',
          items: [
            { label: 'Dos puntos ( : )', text: 'al final de if, elif y else' },
            { label: 'Espacios al inicio', text: 'de la línea dentro del if' },
            { label: 'Comillas', text: 'abriendo y cerrando' },
            { label: 'Mayúsculas importan', text: 'Print ≠ print' },
          ],
          buttonLabel: '🐞 Cazar los errores en Playground',
          tip: '¡Equivocarse es parte del aprendizaje! La consola explica el error en tu idioma.',
        },
        'a1-conversor': {
          tag: 'Mini Proyecto',
          title: 'Mini proyecto: conversor de moneda',
          items: [
            { label: 'Personaliza', text: 'Usa el tipo de cambio del día y la moneda de tu país.' },
            { label: 'float()', text: 'acepta números con punto: 5.50' },
            { label: 'Extra', text: 'Usa round(dolar, 2) para mostrar solo 2 decimales.' },
          ],
          tip: 'Desafío extra: ¡haz el conversor para pesos, bolívares o gourdes!',
        },
        'a1-resumo': {
          title: 'Hoy aprendiste',
          items: [
            { label: 'print', text: 'muestra en pantalla' },
            { label: 'input', text: 'recibe datos' },
            { label: 'variables', text: 'guardan valores' },
            { label: 'if/else', text: 'toma decisiones' },
          ],
        },

        // ---------------- AULA 2 ----------------
        'a2-lista': {
          tag: 'lista',
          title: 'Listas: varias cosas en una caja',
          tip: 'Usa corchetes [ ] y separa los elementos con coma.',
        },
        'a2-indices': {
          tag: 'índice [0]',
          title: 'Índices: la posición de cada ítem',
          items: [
            { label: '[0]', text: 'maçã' },
            { label: '[1]', text: 'banana' },
            { label: '[2]', text: 'uva' },
          ],
          tip: '¡El conteo empieza en 0!',
        },
        'a2-negativo': {
          tag: 'índice [-1]',
          title: 'Del final al principio',
          tip: '[-1] es siempre el último elemento de la lista.',
        },
        'a2-trocar': {
          tag: 'índice',
          title: 'Cambiar un elemento',
          tip: 'Usa la posición con = para poner un valor nuevo en su lugar.',
        },
        'a2-append': {
          tag: 'append()',
          title: 'append: añadir al final',
          tip: 'append coloca el elemento nuevo siempre al final de la lista.',
        },
        'a2-remove': {
          tag: 'remove()',
          title: 'remove: quitar de la lista',
          tip: 'remove busca por el valor (el nombre del ítem), no por la posición.',
        },
        'a2-len': {
          tag: 'len()',
          title: 'len: ¿cuántos elementos hay?',
          tip: 'len viene de “length”, que significa longitud o tamaño.',
        },
        'a2-in': {
          tag: 'in',
          title: 'in: ¿está en la lista?',
          tip: 'in responde “sí” o “no”: ¿el elemento está dentro de la lista?',
        },
        'a2-desafio-2': {
          tag: 'Desafío 2',
          title: 'Desafío 2',
          items: [
            { label: 'Crea una lista con 3 ciudades' },
            { label: 'Muestra la primera ciudad [0]' },
            { label: 'Añade una más con append()' },
            { label: 'Muestra el total con len()' },
          ],
        },
        'a2-for': {
          tag: 'for',
          title: 'for: repetir para cada ítem',
          tip: 'Las líneas con 4 espacios al inicio son las que se repiten.',
        },
        'a2-range': {
          tag: 'for + range()',
          title: 'for con range: contar',
          tip: 'range(1, 6) va del 1 hasta el 5. ¡El último número no entra!',
        },
        'a2-tabuada': {
          tag: 'for + input',
          title: 'Tabla de multiplicar con for',
          tip: 'Con 2 líneas de código la computadora hace 10 cuentas por ti.',
        },
        'a2-while': {
          tag: 'while',
          title: 'while: repetir mientras sea verdad',
          tip: '¡No olvides cambiar el contador, si no la repetición nunca se detiene! (Usa ⏹ Detener.)',
        },
        'a2-while-input': {
          tag: 'while + input',
          title: 'while con input: hasta escribir “sair”',
          tip: 'while sigue preguntando mientras la condición sea verdadera.',
        },
        'a2-for-ou-while': {
          tag: 'Comparación',
          title: '¿for o while?',
          items: [
            { label: 'for', text: 'cuando sabes cuántas veces: cada ítem de la lista, o range(1, 11)' },
            { label: 'while', text: 'cuando depende de una condición: hasta que la persona escriba “sair”' },
          ],
          tip: 'Ambos repiten. La diferencia es cuándo se detienen.',
        },
        'a2-cuidado': {
          tag: 'Atención',
          title: 'Cuidado con estos detalles',
          items: [
            { label: 'Corchetes', text: 'para crear listas y obtener posiciones' },
            { label: 'Empieza en 0', text: '3 elementos = posiciones 0, 1 y 2' },
            { label: 'Dos puntos ( : )', text: 'al final de for y while' },
            { label: 'Espacios', text: 'en las líneas dentro de la repetición' },
          ],
          buttonLabel: '🐞 Ver el error en Playground',
          tip: 'Pedir una posición que no existe genera IndexError.',
        },
        'a2-lista-compras': {
          tag: 'Mini Proyecto',
          title: 'Mini Proyecto: Lista de Compras',
          items: [
            { label: 'compras = [ ]', text: 'empieza con la lista vacía' },
            { label: 'while', text: 'pregunta hasta escribir “sair”' },
            { label: 'append()', text: 'guarda cada elemento' },
            { label: 'for', text: 'muestra la lista al final' },
          ],
          tip: 'Une todo lo aprendido: lista, input, while, if, append, len y for.',
        },
        'a2-lista-turbo': {
          tag: 'Proyecto Turbo',
          title: 'Lista de Compras: versión turbo (con menú)',
          items: [
            { label: 'remove()', text: 'quita un elemento de la lista' },
            { label: 'in', text: 'comprueba si el ítem existe antes de quitarlo' },
            { label: 'compras[i]', text: 'muestra cada ítem según su posición' },
          ],
          tip: 'Desafío extra: crea la opción 5 para mostrar el primer ítem de la lista.',
        },
        'a2-resumo': {
          title: 'Hoy aprendiste',
          items: [
            { label: 'listas [ ]', text: 'guardan varios valores' },
            { label: '[0]', text: 'es el primer elemento' },
            { label: 'append / remove', text: 'añaden y quitan elementos' },
            { label: 'len', text: 'cuenta los elementos' },
            { label: 'for', text: 'repite para cada elemento' },
            { label: 'while', text: 'repite mientras sea verdad' },
          ],
        },
      },
    },

    /* =======================================================
       ENGLISH (EN)
       ======================================================= */
    en: {
      lessons: {
        'aula-1': {
          title: 'First Steps',
          subtitle: 'print · input · variables · if/else',
          topics: [
            { name: 'print', desc: 'Show on screen' },
            { name: 'input', desc: 'Receive user input' },
            { name: 'variables', desc: 'Store values' },
            { name: 'if / else', desc: 'Make decisions' },
          ],
        },
        'aula-2': {
          title: 'Lists and Loops',
          subtitle: 'lists · indexes · append · remove · len · for · while',
          topics: [
            { name: 'lists [ ]', desc: 'Store multiple items' },
            { name: 'indexes', desc: 'Each item position' },
            { name: 'for', desc: 'Repeat for each item' },
            { name: 'while', desc: 'Repeat while true' },
          ],
        },
      },
      cards: {
        'a1-python': {
          tag: 'Introduction',
          title: 'What is Python?',
          text: 'A language for giving step-by-step instructions to a computer.',
          tip: 'The computer reads code from top to bottom, one line at a time.',
        },
        'a1-onde': {
          tag: 'Tool',
          title: 'Where we will code',
          text: 'Right here in this site’s Playground — works on phone and computer with nothing to install.',
          items: [
            { label: 'Write the code', text: 'In the editor (left side)' },
            { label: 'Click Run Code', text: 'To execute the program' },
            { label: 'See the output', text: 'In the Console (right side)' },
          ],
          tip: 'At home you can also use VS Code with Python installed (python.org → check “Add Python to PATH”).',
        },
        'a1-print': {
          tag: 'print',
          title: 'print: show on screen',
          tip: 'Text always goes inside quotes.',
        },
        'a1-print-varios': {
          tag: 'print',
          title: 'print with multiple items',
          tip: 'A comma separates items and Python automatically adds a space between them.',
        },
        'a1-print-contas': {
          tag: 'print',
          title: 'Math and text',
          tip: 'Without quotes, Python calculates the math. With quotes, it is just text!',
        },
        'a1-comentario': {
          tag: 'comment',
          title: 'Comment (#)',
          tip: 'Python ignores everything after #. Use it to write notes in your code.',
        },
        'a1-desafio-1': {
          tag: 'Challenge 1',
          title: 'Challenge 1',
          items: [
            { label: 'Print your name' },
            { label: 'Print your country' },
            { label: 'Print a sentence about you' },
          ],
        },
        'a1-variaveis': {
          tag: 'variables',
          title: 'Variables: labeled boxes',
          items: [
            { label: 'nome', text: 'stores text' },
            { label: 'idade', text: 'stores a number' },
          ],
          tip: 'The = sign puts the value inside the box (variable).',
        },
        'a1-tipos': {
          tag: 'variables',
          title: 'Variable types',
          items: [
            { label: 'str', text: 'text, inside quotes' },
            { label: 'int', text: 'whole number' },
            { label: 'float', text: 'decimal number' },
          ],
          tip: 'Text goes in quotes. Numbers do not. Decimals use a dot, not a comma: 1.75',
        },
        'a1-regras': {
          tag: 'variables',
          title: 'Variable naming rules',
          tip: 'No spaces in the name, do not start with a digit, and remember: the box keeps the latest value.',
        },
        'a1-input': {
          tag: 'input',
          title: 'input: read user data',
          tip: 'Whatever the user types is saved into a variable.',
        },
        'a1-input-texto': {
          tag: 'input',
          title: 'input returns text',
          tip: 'For numbers, wrap input() in int() or float().',
        },
        'a1-soma': {
          tag: 'input',
          title: 'Addition calculator',
          tip: 'int(input(...)) converts what you typed into a whole number.',
        },
        'a1-if': {
          tag: 'if / else',
          title: 'if / else: make decisions',
          items: [
            { label: '==', text: 'equal' },
            { label: '!=', text: 'not equal' },
            { label: '>', text: 'greater than' },
            { label: '<', text: 'less than' },
            { label: '>=', text: 'greater or equal' },
            { label: '<=', text: 'less or equal' },
          ],
          tip: 'Put a colon (:) at the end and 4 spaces at the start of the inner line.',
        },
        'a1-elif': {
          tag: 'if / else',
          title: 'elif: more than one option',
          items: [
            { label: 'if', text: 'checks first' },
            { label: 'elif', text: 'otherwise check this' },
            { label: 'else', text: 'if none matched' },
          ],
          tip: 'Python stops at the first condition that is true.',
        },
        'a1-and-or': {
          tag: 'if / else',
          title: 'and & or: combine conditions',
          items: [
            { label: 'and', text: 'both must be true' },
            { label: 'or', text: 'at least one must be true' },
          ],
          tip: 'Change the values of idade and dia in the Playground and see what happens!',
        },
        'a1-cuidado': {
          tag: 'Watch out',
          title: 'Watch out for these details',
          items: [
            { label: 'Colon ( : )', text: 'at the end of if, elif, and else' },
            { label: 'Leading spaces', text: 'on lines inside if' },
            { label: 'Quotes', text: 'opening and closing pairs' },
            { label: 'Case matters', text: 'Print ≠ print' },
          ],
          buttonLabel: '🐞 Hunt bugs in Playground',
          tip: 'Mistakes are part of learning! The console explains errors in plain language.',
        },
        'a1-conversor': {
          tag: 'Mini Project',
          title: 'Mini project: currency converter',
          items: [
            { label: 'Customize', text: 'Use today’s exchange rate and your home currency.' },
            { label: 'float()', text: 'accepts decimals with a dot: 5.50' },
            { label: 'Bonus', text: 'Use round(dolar, 2) to show only 2 decimal places.' },
          ],
          tip: 'Bonus challenge: adapt the converter for pesos, bolivars, or gourdes!',
        },
        'a1-resumo': {
          title: 'Today you learned',
          items: [
            { label: 'print', text: 'shows output on screen' },
            { label: 'input', text: 'receives user input' },
            { label: 'variables', text: 'store values' },
            { label: 'if/else', text: 'makes decisions' },
          ],
        },

        // ---------------- LESSON 2 ----------------
        'a2-lista': {
          tag: 'list',
          title: 'Lists: multiple values in one box',
          tip: 'Use square brackets [ ] and separate items with commas.',
        },
        'a2-indices': {
          tag: 'index [0]',
          title: 'Indexes: each item’s position',
          items: [
            { label: '[0]', text: 'maçã' },
            { label: '[1]', text: 'banana' },
            { label: '[2]', text: 'uva' },
          ],
          tip: 'Counting starts at 0!',
        },
        'a2-negativo': {
          tag: 'index [-1]',
          title: 'From the end backward',
          tip: '[-1] is always the last item in the list.',
        },
        'a2-trocar': {
          tag: 'index',
          title: 'Replace an item',
          tip: 'Use the index with = to put a new value in that spot.',
        },
        'a2-append': {
          tag: 'append()',
          title: 'append: add to the end',
          tip: 'append always adds the new item to the end of the list.',
        },
        'a2-remove': {
          tag: 'remove()',
          title: 'remove: delete from list',
          tip: 'remove searches by value (the item name), not by position.',
        },
        'a2-len': {
          tag: 'len()',
          title: 'len: how many items?',
          tip: 'len comes from “length” — the size of the list.',
        },
        'a2-in': {
          tag: 'in',
          title: 'in: is it in the list?',
          tip: 'in answers yes or no: is the item inside the list?',
        },
        'a2-desafio-2': {
          tag: 'Challenge 2',
          title: 'Challenge 2',
          items: [
            { label: 'Create a list with 3 cities' },
            { label: 'Print the first city [0]' },
            { label: 'Add another one with append()' },
            { label: 'Print the total using len()' },
          ],
        },
        'a2-for': {
          tag: 'for',
          title: 'for: repeat for each item',
          tip: 'Lines starting with 4 spaces are the ones that repeat.',
        },
        'a2-range': {
          tag: 'for + range()',
          title: 'for with range: counting',
          tip: 'range(1, 6) goes from 1 up to 5. The last number is excluded!',
        },
        'a2-tabuada': {
          tag: 'for + input',
          title: 'Times table with for',
          tip: 'With 2 lines of code the computer runs 10 calculations for you.',
        },
        'a2-while': {
          tag: 'while',
          title: 'while: repeat while true',
          tip: 'Do not forget to update the counter, or the loop never stops! (Use ⏹ Stop.)',
        },
        'a2-while-input': {
          tag: 'while + input',
          title: 'while with input: until typing “sair”',
          tip: 'while keeps asking as long as the condition stays true.',
        },
        'a2-for-ou-while': {
          tag: 'Comparison',
          title: 'for or while?',
          items: [
            { label: 'for', text: 'when you know how many times: each list item, or range(1, 11)' },
            { label: 'while', text: 'when it depends on a condition: until the user types “sair”' },
          ],
          tip: 'Both repeat. The difference is when they stop.',
        },
        'a2-cuidado': {
          tag: 'Watch out',
          title: 'Watch out for these details',
          items: [
            { label: 'Brackets', text: 'to create lists and access positions' },
            { label: 'Starts at 0', text: '3 items = positions 0, 1, and 2' },
            { label: 'Colon ( : )', text: 'at the end of for and while' },
            { label: 'Spaces', text: 'on lines inside the loop' },
          ],
          buttonLabel: '🐞 See the error in Playground',
          tip: 'Asking for a position that does not exist raises IndexError.',
        },
        'a2-lista-compras': {
          tag: 'Mini Project',
          title: 'Mini Project: Shopping List',
          items: [
            { label: 'compras = [ ]', text: 'starts with an empty list' },
            { label: 'while', text: 'asks until typing “sair”' },
            { label: 'append()', text: 'stores each item' },
            { label: 'for', text: 'prints the final list' },
          ],
          tip: 'Brings everything together: list, input, while, if, append, len, and for!',
        },
        'a2-lista-turbo': {
          tag: 'Turbo Project',
          title: 'Shopping List: turbo version (with menu)',
          items: [
            { label: 'remove()', text: 'removes an item from the list' },
            { label: 'in', text: 'checks whether the item exists before removing' },
            { label: 'compras[i]', text: 'displays each item by position' },
          ],
          tip: 'Bonus challenge: add option 5 to display the first item in the list.',
        },
        'a2-resumo': {
          title: 'Today you learned',
          items: [
            { label: 'lists [ ]', text: 'store multiple values' },
            { label: '[0]', text: 'is the first item' },
            { label: 'append / remove', text: 'add and remove items' },
            { label: 'len', text: 'counts items' },
            { label: 'for', text: 'repeats for each item' },
            { label: 'while', text: 'repeats while true' },
          ],
        },
      },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

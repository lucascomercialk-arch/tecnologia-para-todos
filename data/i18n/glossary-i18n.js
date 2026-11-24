/* =========================================================
   Tecnologia para Todos — Traduções do Glossário (ES/EN)
   ---------------------------------------------------------
   O português (PT) fica no arquivo base data/glossary.js.
   Este arquivo traduz todos os termos em Espanhol (es) e
   Inglês (en), indexados exatamente pelo campo `term` base.
   ========================================================= */
(function (root) {
  'use strict';

  root.TPT_GLOSSARY_I18N = {
    es: {
      Python: {
        simple:
          'Un lenguaje de programación: una forma de escribir instrucciones que la computadora entiende. Es uno de los más fáciles para empezar.',
      },
      código: {
        termLabel: 'código',
        simple:
          'El texto con las instrucciones que escribes para la computadora. La computadora lo lee de arriba hacia abajo, una línea a la vez.',
      },
      programa: {
        termLabel: 'programa',
        simple:
          'Un conjunto de instrucciones que realiza alguna tarea. Ej.: una calculadora o una lista de compras.',
      },
      'console / terminal': {
        termLabel: 'consola / terminal',
        simple:
          'La pantalla oscura donde aparecen las respuestas del programa (lo que muestra print) y donde escribes en input.',
      },
      'erro (bug)': {
        termLabel: 'error (bug)',
        simple:
          'Cuando Python no entiende el código o algo sale mal. ¡Es normal y parte del aprendizaje! El mensaje de error indica la línea del problema.',
        output: 'NameError: Python no conoce "Print"',
      },
      'comentário #': {
        termLabel: 'comentario #',
        simple:
          'Una anotación para personas, no para la computadora. Todo lo que va después de # es ignorado por Python.',
      },
      'indentação (espaços)': {
        termLabel: 'sangría (espacios)',
        simple:
          'Los 4 espacios al inicio de la línea. Muestran lo que está “dentro” de un if, for o while. ¡En Python, los espacios son obligatorios!',
      },
      'print()': {
        simple: 'Muestra un mensaje en pantalla (en la consola). Los textos van entre comillas.',
      },
      'input()': {
        simple:
          'Hace una pregunta y espera a que la persona escriba. La respuesta siempre llega como texto.',
      },
      'int()': {
        simple:
          'Convierte un texto en número entero (sin decimales). Úsalo junto con input para hacer cuentas.',
      },
      'float()': {
        simple:
          'Convierte un texto en número decimal (con punto). Atención: usa punto, no coma: 5.50',
      },
      variável: {
        termLabel: 'variable',
        simple:
          'Una caja con nombre que guarda un valor. El signo = coloca el valor dentro de la caja.',
      },
      'str (texto)': {
        termLabel: 'str (texto)',
        simple: 'Tipo de valor que es texto. Siempre va entre comillas: "Ana", "123", "¡Hola!".',
      },
      'aspas " "': {
        termLabel: 'comillas " "',
        simple:
          'Marcan el inicio y el fin de un texto. Con comillas es texto; sin comillas Python cree que es una variable o un número.',
      },
      '= (atribuição)': {
        termLabel: '= (asignación)',
        simple:
          'Un signo igual guarda un valor en la variable. ¡No sirve para comparar! Para comparar usa ==.',
      },
      if: {
        simple:
          'Quiere decir “si”. Evalúa una condición: si es verdadera, ejecuta lo que está dentro (con espacios).',
      },
      else: {
        simple:
          'Quiere decir “si no”. Es lo que ocurre cuando la condición del if no es verdadera.',
      },
      elif: {
        simple: 'Unión de “else if”: “si no, si…”. Sirve para evaluar una opción adicional.',
      },
      'comparações == != > <': {
        termLabel: 'comparaciones == != > <',
        simple:
          '== igual · != diferente · > mayor · < menor · >= mayor o igual · <= menor o igual. La respuesta es True (verdadero) o False (falso).',
      },
      'and / or': {
        simple:
          'and (“y”): ambas condiciones deben ser verdaderas. or (“o”): basta con que una sea verdadera.',
      },
      'True / False': {
        simple:
          'Verdadero y Falso. Son las respuestas de una pregunta (condición). Escríbelos con la primera letra en mayúscula.',
      },
      'lista [ ]': {
        termLabel: 'lista [ ]',
        simple:
          'Una variable que guarda varios valores en orden. Usa corchetes [ ] y comas entre los elementos.',
      },
      'índice [0]': {
        termLabel: 'índice [0]',
        simple:
          'La posición de un elemento en la lista. ¡El conteo empieza en 0! [-1] es el último elemento.',
      },
      'append()': {
        simple: 'Añade un elemento nuevo al final de la lista. Quiere decir “anexar, agregar”.',
      },
      'remove()': {
        simple:
          'Quita un elemento de la lista buscando por su valor (el nombre del ítem). Si el ítem no existe, da error.',
      },
      'len()': {
        simple:
          'Cuenta cuántos elementos tiene la lista (o cuántas letras tiene un texto). Viene de “length” = longitud.',
      },
      in: {
        simple:
          'Pregunta si un elemento está dentro de la lista. La respuesta es True o False. En for, significa “en”.',
      },
      for: {
        simple:
          'Repite las líneas de adentro “para cada” elemento de una lista (o de un range). Úsalo cuando sabes cuántas veces repetir.',
      },
      'range()': {
        simple:
          'Crea una secuencia de números para for. range(1, 4) genera 1, 2, 3 — ¡el último número no entra!',
      },
      while: {
        simple:
          'Quiere decir “mientras”. Repite mientras la condición sea verdadera. ¡Cuidado con no repetir para siempre!',
      },
      'loop (repetição)': {
        termLabel: 'bucle (loop)',
        simple:
          'Cuando una parte del código se repite varias veces. for y while crean bucles. Un “bucle infinito” es cuando nunca termina.',
      },
      import: {
        simple:
          'Comando usado al inicio del código para traer bibliotecas listas a tu programa.',
      },
      'biblioteca / módulo': {
        termLabel: 'biblioteca / módulo',
        simple:
          'Un paquete con funciones y herramientas listas que ya vienen en Python (como random, time, math y datetime).',
      },
      random: {
        simple:
          'Biblioteca para generar números aleatorios, hacer sorteos y mezclar listas.',
      },
      'random.randint()': {
        simple:
          'Sortea un número entero entre dos límites, incluyendo el primer y el último número.',
      },
      'random.choice()': {
        simple:
          'Elige aleatoriamente un elemento de una lista.',
      },
      'time.sleep()': {
        simple:
          'Pausa la ejecución del programa durante una cantidad de segundos (puedes usar decimales como 0.5).',
      },
      math: {
        simple:
          'Biblioteca matemática con funciones como sqrt() (raíz cuadrada), ceil(), floor() y la constante pi.',
      },
      datetime: {
        simple:
          'Biblioteca para trabajar con fechas y horas actuales en el programa.',
      },
    },

    en: {
      Python: {
        simple:
          'A programming language: a way of writing instructions that a computer understands. It is one of the easiest languages to start with.',
      },
      código: {
        termLabel: 'code',
        simple:
          'The text with instructions you write for the computer. The computer reads it from top to bottom, one line at a time.',
      },
      programa: {
        termLabel: 'program',
        simple:
          'A set of instructions that performs a task. Example: a calculator or a shopping list.',
      },
      'console / terminal': {
        termLabel: 'console / terminal',
        simple:
          'The dark screen where your program’s answers appear (from print) and where you type for input.',
      },
      'erro (bug)': {
        termLabel: 'error (bug)',
        simple:
          'When Python does not understand the code or something goes wrong. Totally normal! The error message points to the line with the issue.',
        output: 'NameError: Python does not know "Print"',
      },
      'comentário #': {
        termLabel: 'comment #',
        simple:
          'A note for humans, not for the computer. Everything after # is ignored by Python.',
      },
      'indentação (espaços)': {
        termLabel: 'indentation (spaces)',
        simple:
          'The 4 spaces at the start of a line. They show what belongs “inside” an if, for, or while. In Python, indentation is mandatory!',
      },
      'print()': {
        simple: 'Displays a message on screen (in the console). Text goes inside quotes.',
      },
      'input()': {
        simple:
          'Asks a question and waits for the user to type. The answer always arrives as text.',
      },
      'int()': {
        simple:
          'Converts text into a whole number (integer). Wrap input() with it when doing integer math.',
      },
      'float()': {
        simple:
          'Converts text into a decimal number. Watch out: use a dot, not a comma: 5.50',
      },
      variável: {
        termLabel: 'variable',
        simple:
          'A labeled box that stores a value. The = sign puts the value inside the box.',
      },
      'str (texto)': {
        termLabel: 'str (string)',
        simple: 'The text data type. Always wrapped in quotes: "Ana", "123", "Hello!".',
      },
      'aspas " "': {
        termLabel: 'quotes " "',
        simple:
          'Mark the start and end of text. With quotes it is text; without quotes Python treats it as a variable or number.',
      },
      '= (atribuição)': {
        termLabel: '= (assignment)',
        simple:
          'A single equals sign stores a value in a variable. It is not for comparing! Use == to compare.',
      },
      if: {
        simple:
          'Tests a condition: if it is true, Python runs the indented lines inside.',
      },
      else: {
        simple:
          'Runs when the if condition is false (meaning “otherwise”).',
      },
      elif: {
        simple: 'Short for “else if”. Used to test another condition when the previous one was false.',
      },
      'comparações == != > <': {
        termLabel: 'comparisons == != > <',
        simple:
          '== equal · != not equal · > greater · < less · >= greater or equal · <= less or equal. The result is True or False.',
      },
      'and / or': {
        simple:
          'and: both conditions must be true. or: at least one condition must be true.',
      },
      'True / False': {
        simple:
          'Boolean answers to a condition. Always start with an uppercase first letter.',
      },
      'lista [ ]': {
        termLabel: 'list [ ]',
        simple:
          'A variable that holds multiple values in order. Uses square brackets [ ] and commas between items.',
      },
      'índice [0]': {
        termLabel: 'index [0]',
        simple:
          'The position of an item in a list. Counting starts at 0! [-1] is the last item.',
      },
      'append()': {
        simple: 'Adds a new item to the end of a list.',
      },
      'remove()': {
        simple:
          'Removes an item from a list by value (item name). Raises an error if the item is not there.',
      },
      'len()': {
        simple:
          'Counts how many items are in a list (or characters in a string). Short for “length”.',
      },
      in: {
        simple:
          'Checks whether an item is inside a list (returns True or False). Inside a for loop, it iterates over items.',
      },
      for: {
        simple:
          'Repeats the indented lines “for each” item in a list (or range). Use when you know how many times to repeat.',
      },
      'range()': {
        simple:
          'Creates a sequence of numbers for a for loop. range(1, 4) yields 1, 2, 3 — the stop number is excluded!',
      },
      while: {
        simple:
          'Repeats as long as a condition stays true. Be careful not to create an infinite loop!',
      },
      'loop (repetição)': {
        termLabel: 'loop',
        simple:
          'When a block of code repeats multiple times. for and while create loops. An “infinite loop” never stops.',
      },
      import: {
        simple:
          'Command placed at the top of your code to bring ready-made libraries into your program.',
      },
      'biblioteca / módulo': {
        termLabel: 'library / module',
        simple:
          'A bundle of built-in functions and tools included in Python (such as random, time, math, and datetime).',
      },
      random: {
        simple:
          'Library for generating random numbers, running draws, and shuffling lists.',
      },
      'random.randint()': {
        simple:
          'Picks a random whole number between two limits, including both endpoints.',
      },
      'random.choice()': {
        simple:
          'Randomly picks one item from a list.',
      },
      'time.sleep()': {
        simple:
          'Pauses program execution for a number of seconds (decimals like 0.5 work too).',
      },
      math: {
        simple:
          'Math library providing functions like sqrt() (square root), ceil(), floor(), and pi.',
      },
      datetime: {
        simple:
          'Library for working with current dates and clock times in your program.',
      },
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

let colors = ['blue', 'yellow', 'green', 'black', 'brown', 'purple', 'orange', 'gold'];

let button = document.getElementById('button');

button.addEventListener('click', function(){

    var randomColor = colors[Math.floor(Math.random() * colors.length)]

    let container = document.getElementById('container');

    container.style.background = randomColor
})
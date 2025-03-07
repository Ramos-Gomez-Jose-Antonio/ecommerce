function cambiarV(){
    window.location.assign("FormNewPro.html");
}

function crearC(){
    window.location.assign("crearCu.html");
}

function carrito(){
    window.location.assign("carrito.html");
}

function mostrarPlan() {
    var listaP = document.getElementsByClassName("listaP")[0];

    if (listaP.style.visibility === "hidden" || listaP.style.visibility === "") {
        listaP.style.visibility = "visible";
    } else {
        listaP.style.visibility = "hidden";
    }
}

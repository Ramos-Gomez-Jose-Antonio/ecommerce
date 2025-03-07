// Cambiar la ubicación al hacer clic en el botón de "Comprar"
function cambiarCom() {
    window.location.assign("comprar.html");
}

// Función para validar el formulario
function validarForm() {
    // Obtener todos los campos del formulario
    const nombre = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const cantidad = document.getElementById('cantidad').value.trim();
    const costo = document.getElementById('costo').value.trim();
    const image = document.getElementById('image').files.length;
    const plantel = document.getElementById('plantel').value.trim();
    const catalogo = document.getElementById('catalogo').value.trim();

    // Verificar que todos los campos estén llenos
    if (!nombre || !descripcion || !cantidad || !costo || !image || !plantel || !catalogo) {
        alert("Por favor, complete todos los campos antes de enviar.");
        return false;
    }

    // Verificar que los valores numéricos sean correctos
    if (cantidad <= 0 || costo <= 0) {
        alert("La cantidad y el costo deben ser valores positivos.");
        return false;
    }

    // Si todo está correcto, se envía el formulario
    alert("Formulario enviado correctamente. ¡Gracias!");
    return true;
}

// Función para manejar el envío del formulario
function subirForm() {
    // Validar el formulario
    const isValid = validarForm();
    if (isValid) {
        // Si es válido, enviar el formulario
        document.getElementById('newProductForm').submit();
    }
}

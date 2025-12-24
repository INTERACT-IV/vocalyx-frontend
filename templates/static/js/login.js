document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const errorMessage = document.getElementById("error-message");
    const loginButton = document.getElementById("login-button");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        errorMessage.style.display = "none";
        loginButton.disabled = true;
        loginButton.textContent = "Connexion...";

        const formData = new FormData(loginForm);
        
        try {
            // On appelle le backend du *frontend*
            const response = await fetch("/auth/login", {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Échec de la connexion");
            }

            // Connexion réussie, rediriger vers le dashboard
            window.location.href = "/";

        } catch (err) {
            errorMessage.textContent = err.message;
            errorMessage.style.display = "block";
            loginButton.disabled = false;
            loginButton.textContent = "Connexion";
        }
    });
});
  async function lockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock("landscape");
      } catch (e) {
        // Safari / iOS no permite forzar
        console.warn("No se pudo bloquear la orientación");
      }
    }
  }

  lockLandscape();
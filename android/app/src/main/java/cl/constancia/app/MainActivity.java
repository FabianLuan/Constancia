package cl.constancia.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    // Altura de la barra de estado y de navegación en px CSS; se envía a la página en cada carga.
    private void sendInsets(WebView wv) {
        WindowInsetsCompat w = ViewCompat.getRootWindowInsets(wv);
        if (w == null) return;
        Insets i = w.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
        float d = getResources().getDisplayMetrics().density;
        String js = String.format(java.util.Locale.US,
            "document.documentElement.style.setProperty('--native-sat','%.1fpx');document.documentElement.style.setProperty('--native-sab','%.1fpx');document.documentElement.dataset.native='1';",
            i.top / d, i.bottom / d);
        wv.evaluateJavascript(js, null);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) { sendInsets(webView); webView.postDelayed(() -> sendInsets(webView), 600); }
            @Override
            public void onPageCommitVisible(WebView view, String url) { sendInsets(view); }
        });
    }
}

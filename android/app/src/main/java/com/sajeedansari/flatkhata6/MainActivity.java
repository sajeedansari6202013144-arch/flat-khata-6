package com.sajeedansari.flatkhata6;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.ValueCallback;
import android.provider.MediaStore;

public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> fileChooserCallback;
    private static final int FILE_CHOOSER_REQUEST = 4106;
    private static final String HOME = "https://sajeedansari6202013144-arch.github.io/flat-khata-6/";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(6,17,14));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(6,17,14));
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        // Always fetch the latest hosted app files instead of reusing stale WebView assets.
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(pick, "Choose profile photo"), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    fileChooserCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return route(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return route(url);
            }
        });
        setContentView(web);
        android.webkit.CookieManager.getInstance().setAcceptCookie(true);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.clearCache(true);
        web.loadUrl(HOME + "?apk_refresh=20261111");
    }
    private boolean route(String url) {
        if (url.startsWith("upi:") || url.startsWith("intent:") || url.startsWith("tel:") || url.startsWith("mailto:")) {
            try { startActivity(Intent.parseUri(url, Intent.URI_INTENT_SCHEME)); }
            catch (Exception e) { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {} }
            return true;
        }
        if (!url.startsWith("https://sajeedansari6202013144-arch.github.io/flat-khata-6/")) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
            return true;
        }
        return false;
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileChooserCallback != null) {
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri selected = data.getData();
                if (selected != null) results = new Uri[]{selected};
            }
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }
}

package com.fingent360.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.*;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.JSONObject;

public class MainActivity extends ComponentActivity {
  private static final String LOCAL = "https://appassets.androidplatform.net";
  private WebView web;
  private JSONObject config;
  private String bundleIdentity = "unknown";
  private boolean recoveryOpen = false;
  private ValueCallback<Uri[]> fileChoice;
  private byte[] exportData;
  private String exportName;
  private static final int OPEN = 71, SAVE = 72;
  private SharedPreferences prefs;

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    prefs = getSharedPreferences("connection", MODE_PRIVATE);
    try {
      String defaults = new String(readAsset("runtime-config.json"), StandardCharsets.UTF_8);
      config = new JSONObject(prefs.getString("config", defaults));
      validate(config);
    } catch (Exception e) {
      config = new JSONObject();
      try {
        config.put("mode", "offline").put("webUrl", "").put("apiUrl", "");
      } catch (Exception ignored) {
      }
    }
    androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    FrameLayout root = new FrameLayout(this);
    setContentView(root);
    ViewCompat.setOnApplyWindowInsetsListener(
        root,
        (view, insets) -> {
          Insets bars =
              insets.getInsets(
                  WindowInsetsCompat.Type.systemBars()
                      | WindowInsetsCompat.Type.displayCutout()
                      | WindowInsetsCompat.Type.ime());
          view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
          return WindowInsetsCompat.CONSUMED;
        });
    ViewCompat.requestApplyInsets(root);
    if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
        || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      LinearLayout recovery = new LinearLayout(this);
      recovery.setOrientation(LinearLayout.VERTICAL);
      recovery.setPadding(24, 48, 24, 24);
      TextView message = new TextView(this);
      message.setText(
          "Update Android System WebView or Google Chrome to open Fingent360 securely. Your stored"
              + " data is unchanged.");
      recovery.addView(message);
      Button update = new Button(this);
      update.setText("Open WebView update");
      update.setOnClickListener(
          v ->
              openExternal(
                  Uri.parse(
                      "https://play.google.com/store/apps/details?id=com.google.android.webview")));
      recovery.addView(update);
      root.addView(recovery);
      return;
    }
    web = new WebView(this);
    root.addView(web, new FrameLayout.LayoutParams(-1, -1));
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);
    settings.setSupportMultipleWindows(true);
    settings.setMediaPlaybackRequiresUserGesture(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    WebViewAssetLoader loader =
        new WebViewAssetLoader.Builder()
            .addPathHandler(
                "/",
                path -> {
                  try {
                    String clean = path.isEmpty() ? "index.html" : path;
                    if (clean.contains("..") || clean.contains("\\")) return empty(400);
                    InputStream input = getAssets().open("web/" + clean);
                    String extension = MimeTypeMap.getFileExtensionFromUrl(clean),
                        mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    if (clean.endsWith(".csv")) mime = "text/csv";
                    if (clean.endsWith(".js")) mime = "application/javascript";
                    if (clean.endsWith(".webmanifest")) mime = "application/manifest+json";
                    return new WebResourceResponse(
                        mime == null ? "application/octet-stream" : mime, "UTF-8", input);
                  } catch (IOException e) {
                    return empty(404);
                  }
                })
            .build();
    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public WebResourceResponse shouldInterceptRequest(
              WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (url.startsWith(LOCAL + "/")) return loader.shouldInterceptRequest(request.getUrl());
            if (!connected() || !allowedNetwork(request.getUrl())) return empty(503);
            return null;
          }

          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (trusted(uri) && request.isForMainFrame()) return false;
            if (request.isForMainFrame() && request.hasGesture()) openExternal(uri);
            return true;
          }

          @Override
          public void onReceivedSslError(
              WebView view, SslErrorHandler handler, android.net.http.SslError error) {
            handler.cancel();
          }

          @Override
          public void onReceivedError(
              WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showRecovery();
          }

          @Override
          public void onReceivedHttpError(
              WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 400) showRecovery();
          }
        });
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            if (!trusted(Uri.parse(url))) {
              result.cancel();
              return true;
            }
            new AlertDialog.Builder(MainActivity.this)
                .setMessage(message)
                .setPositiveButton("Continue", (d, w) -> result.confirm())
                .setNegativeButton("Cancel", (d, w) -> result.cancel())
                .setOnCancelListener(d -> result.cancel())
                .show();
            return true;
          }

          @Override
          public boolean onShowFileChooser(
              WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileChoice != null) fileChoice.onReceiveValue(null);
            fileChoice = callback;
            Intent intent =
                new Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
            intent.putExtra(
                Intent.EXTRA_MIME_TYPES,
                new String[] {
                  "text/csv",
                  "text/comma-separated-values",
                  "text/plain",
                  "application/vnd.ms-excel"
                });
            try {
              startActivityForResult(intent, OPEN);
            } catch (Exception e) {
              callback.onReceiveValue(null);
              fileChoice = null;
            }
            return true;
          }

          @Override
          public boolean onCreateWindow(
              WebView view, boolean dialog, boolean userGesture, android.os.Message resultMsg) {
            if (!userGesture) return false;
            WebView transientView = new WebView(MainActivity.this);
            transientView.setWebViewClient(
                new WebViewClient() {
                  @Override
                  public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    openExternal(request.getUrl());
                    v.destroy();
                    return true;
                  }
                });
            ((WebView.WebViewTransport) resultMsg.obj).setWebView(transientView);
            resultMsg.sendToTarget();
            return true;
          }
        });
    try {
      bundleIdentity = new String(readAsset("build-identity.txt"), StandardCharsets.UTF_8);
    } catch (IOException ignored) {
    }
    installBridge();
    getOnBackPressedDispatcher()
        .addCallback(
            this,
            new OnBackPressedCallback(true) {
              @Override
              public void handleOnBackPressed() {
                if (web == null) {
                  finish();
                  return;
                }
                web.evaluateJavascript(
                    "Boolean(window.__fingentHandleBack && window.__fingentHandleBack())",
                    value -> {
                      if (!"true".equals(value)) finish();
                    });
              }
            });
    web.loadUrl(startUrl());
  }

  private byte[] readAsset(String name) throws IOException {
    try (InputStream input = getAssets().open(name);
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int size;
      while ((size = input.read(buffer)) != -1) output.write(buffer, 0, size);
      return output.toByteArray();
    }
  }

  private WebResourceResponse empty(int status) {
    return new WebResourceResponse(
        "text/plain",
        "UTF-8",
        status,
        "Unavailable",
        Collections.singletonMap("Cache-Control", "no-store"),
        new ByteArrayInputStream(new byte[0]));
  }

  private boolean connected() {
    return "connected".equals(config.optString("mode"));
  }

  private String origin(Uri uri) {
    return uri.getScheme()
        + "://"
        + uri.getHost()
        + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
  }

  private boolean trusted(Uri uri) {
    return origin(uri).equals(connected() ? origin(Uri.parse(config.optString("webUrl"))) : LOCAL);
  }

  private boolean allowedNetwork(Uri uri) {
    return "https".equals(uri.getScheme())
        && (trusted(uri) || origin(uri).equals(origin(Uri.parse(config.optString("apiUrl")))));
  }

  private String startUrl() {
    return connected() ? config.optString("webUrl") : LOCAL + "/index.html";
  }

  private void validate(JSONObject value) throws Exception {
    String mode = value.getString("mode");
    if (!mode.equals("offline") && !mode.equals("connected")) throw new Exception();
    if (mode.equals("connected"))
      for (String key : new String[] {"webUrl", "apiUrl"}) {
        Uri uri = Uri.parse(value.getString(key));
        if (!"https".equals(uri.getScheme())
            || uri.getHost() == null
            || uri.getUserInfo() != null
            || uri.getFragment() != null
            || uri.getQuery() != null
            || (!uri.getPath().isEmpty() && !uri.getPath().equals("/"))
            || uri.getHost().equals("appassets.androidplatform.net")) throw new Exception();
      }
  }

  private void installBridge() {
    String trustedOrigin = connected() ? origin(Uri.parse(config.optString("webUrl"))) : LOCAL;
    Set<String> origins = Collections.singleton(trustedOrigin);
    WebViewCompat.addWebMessageListener(
        web,
        "FingentNative",
        origins,
        (view, message, sourceOrigin, isMainFrame, reply) -> {
          if (!isMainFrame || !trusted(sourceOrigin)) return;
          String action = "request";
          try {
            JSONObject data = new JSONObject(message.getData());
            action = data.getString("action");
            if (action.equals("saveFile")) saveFile(data);
            else if (action.equals("setConnection")) setConnection(data);
          } catch (Exception e) {
            event(action, "failed", "Invalid native request.");
          }
        });
    String script =
        "if(window.top===window){window.FingentAndroid=Object.freeze({getConfig:function(){return "
            + JSONObject.quote(config.toString())
            + ";},getBuildInfo:function(){return "
            + JSONObject.quote(
                BuildConfig.VERSION_NAME
                    + " ("
                    + BuildConfig.VERSION_CODE
                    + ") "
                    + BuildConfig.BUILD_TYPE
                    + " bundle:"
                    + bundleIdentity)
            + ";},saveFile:function(filename,mime,base64){FingentNative.postMessage(JSON.stringify({action:'saveFile',filename:filename,mime:mime,base64:base64}));},setConnection:function(mode,webUrl,apiUrl){FingentNative.postMessage(JSON.stringify({action:'setConnection',mode:mode,webUrl:webUrl,apiUrl:apiUrl}));}});}";
    WebViewCompat.addDocumentStartJavaScript(web, script, origins);
  }

  private void setConnection(JSONObject data) throws Exception {
    JSONObject next =
        new JSONObject()
            .put("mode", data.getString("mode"))
            .put("webUrl", data.optString("webUrl", ""))
            .put("apiUrl", data.optString("apiUrl", ""));
    validate(next);
    new AlertDialog.Builder(this)
        .setTitle("Change connection mode?")
        .setMessage(
            "Your offline records stay on this device and are not uploaded. Destination: "
                + (next.getString("mode").equals("offline")
                    ? "Bundled offline app"
                    : next.getString("webUrl")))
        .setPositiveButton(
            "Switch",
            (d, w) -> {
              prefs.edit().putString("config", next.toString()).apply();
              Intent intent = getIntent();
              finish();
              startActivity(intent);
            })
        .setNegativeButton(
            "Cancel", (d, w) -> event("setConnection", "cancelled", "Connection unchanged."))
        .show();
  }

  private void saveFile(JSONObject data) throws Exception {
    if (exportData != null) {
      event("saveFile", "failed", "Another export is waiting for a destination.");
      return;
    }
    String mime = data.getString("mime").split(";", 2)[0].trim();
    if (!Arrays.asList("application/json", "text/csv", "video/webm").contains(mime))
      throw new Exception();
    String encoded = data.getString("base64");
    if (encoded.length() > 48000000) throw new Exception();
    byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
    exportName = data.getString("filename").replaceAll("[^A-Za-z0-9._-]", "_");
    if (exportName.length() > 100) exportName = exportName.substring(0, 100);
    exportData = bytes;
    Intent intent =
        new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime)
            .putExtra(Intent.EXTRA_TITLE, exportName);
    try {
      startActivityForResult(intent, SAVE);
    } catch (Exception e) {
      exportData = null;
      event("saveFile", "failed", "No document provider is available.");
    }
  }

  private void showRecovery() {
    if (!connected() || recoveryOpen || isFinishing()) return;
    recoveryOpen = true;
    new AlertDialog.Builder(this)
        .setTitle("Connected app unavailable")
        .setMessage(
            "Check your connection or return to the bundled offline app. Your local records are"
                + " preserved.")
        .setPositiveButton(
            "Retry",
            (d, w) -> {
              recoveryOpen = false;
              web.reload();
            })
        .setNegativeButton(
            "Use offline app",
            (d, w) -> {
              try {
                config.put("mode", "offline");
                prefs.edit().putString("config", config.toString()).apply();
              } catch (Exception ignored) {
              }
              Intent intent = getIntent();
              finish();
              startActivity(intent);
            })
        .setOnCancelListener(d -> recoveryOpen = false)
        .show();
  }

  private void openExternal(Uri uri) {
    if (!Arrays.asList("https", "mailto").contains(uri.getScheme())) return;
    new AlertDialog.Builder(this)
        .setTitle("Open external link?")
        .setMessage(uri.toString())
        .setPositiveButton(
            "Open",
            (d, w) -> {
              try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
              } catch (Exception e) {
                event("external", "failed", "No app can open this link.");
              }
            })
        .setNegativeButton("Cancel", null)
        .show();
  }

  private void event(String action, String outcome, String message) {
    try {
      if (web == null || isFinishing() || isDestroyed()) return;
      JSONObject payload =
          new JSONObject().put("action", action).put("outcome", outcome).put("message", message);
      web.evaluateJavascript(
          "window.dispatchEvent(new CustomEvent('f360-native-result',{detail:" + payload + "}))",
          null);
    } catch (Exception ignored) {
    }
  }

  private boolean allowedImport(Uri uri) throws IOException {
    if (uri == null || !"content".equals(uri.getScheme())) return false;
    try (Cursor cursor =
        getContentResolver()
            .query(
                uri,
                new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE},
                null,
                null,
                null)) {
      if (cursor != null && cursor.moveToFirst()) {
        String name = cursor.getString(0);
        if (name == null
            || !(name.toLowerCase(Locale.ROOT).endsWith(".csv")
                || name.toLowerCase(Locale.ROOT).endsWith(".txt"))) return false;
        if (!cursor.isNull(1) && cursor.getLong(1) > 12 * 1024 * 1024) return false;
      }
    }
    try (InputStream input = getContentResolver().openInputStream(uri)) {
      if (input == null) return false;
      byte[] buffer = new byte[8192];
      long total = 0;
      int read;
      while ((read = input.read(buffer)) != -1) {
        total += read;
        if (total > 12 * 1024 * 1024) return false;
      }
      return true;
    }
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == OPEN && fileChoice != null) {
      ValueCallback<Uri[]> callback = fileChoice;
      fileChoice = null;
      Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
      if (uri == null) {
        callback.onReceiveValue(null);
        return;
      }
      new Thread(
              () -> {
                boolean valid = false;
                try {
                  valid = allowedImport(uri);
                } catch (Exception ignored) {
                }
                boolean accepted = valid;
                runOnUiThread(
                    () -> {
                      if (isFinishing() || isDestroyed()) return;
                      callback.onReceiveValue(accepted ? new Uri[] {uri} : null);
                      if (!accepted)
                        event("fileChooser", "failed", "Choose a CSV or text file up to 12 MB.");
                    });
              },
              "csv-validation")
          .start();
    }
    if (requestCode == SAVE) {
      byte[] bytes = exportData;
      Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
      if (uri == null || bytes == null) {
        exportData = null;
        event("saveFile", "cancelled", "Export cancelled.");
        return;
      }
      new Thread(
              () -> {
                boolean success = false;
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                  if (out == null) throw new IOException();
                  out.write(bytes);
                  success = true;
                } catch (Exception ignored) {
                }
                boolean saved = success;
                runOnUiThread(
                    () -> {
                      exportData = null;
                      if (!isFinishing() && !isDestroyed())
                        event(
                            "saveFile",
                            saved ? "saved" : "failed",
                            saved ? "File saved." : "Could not save the selected document.");
                    });
              },
              "document-export")
          .start();
    }
  }

  @Override
  protected void onPause() {
    if (web != null) {
      web.onPause();
      web.pauseTimers();
    }
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (web != null) {
      web.onResume();
      web.resumeTimers();
    }
  }

  @Override
  protected void onDestroy() {
    if (fileChoice != null) fileChoice.onReceiveValue(null);
    exportData = null;
    if (web != null) {
      web.stopLoading();
      web.destroy();
    }
    super.onDestroy();
  }
}

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
  private JSONObject pendingKiteCallback;
  private long pendingKiteUntil;
  private JSONObject pendingUpstoxCallback;
  private long pendingUpstoxUntil;
  private JSONObject pendingAngelCallback;
  private long pendingAngelUntil;
  private FeedbackBridge feedback;
  private PermissionRequest microphone;
  private Uri microphoneOrigin;
  private boolean microphonePrompt;
  private boolean activityStopped;
  private long pageGeneration;
  private static final int MICROPHONE = 73;
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
    acceptKiteIntent(getIntent());
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
          public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            pageGeneration++;
            cancelMicrophone();
          }

          @Override
          public WebResourceResponse shouldInterceptRequest(
              WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            // Inline recorder playback and cropped PNG previews never leave this document.
            // Keep main-frame navigation restricted by shouldOverrideUrlLoading.
            if (!request.isForMainFrame() && "data".equals(request.getUrl().getScheme())
                && url.length() <= 8_500_000 && url.matches("(?s)^data:(?:image/png|audio/webm|audio/mp4|audio/ogg);base64,[A-Za-z0-9+/=]+$")) return null;
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
          public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
              if (web == null || web.getUrl() == null || !trusted(request.getOrigin())
                  || !trusted(Uri.parse(web.getUrl())) || !origin(request.getOrigin()).equals(origin(Uri.parse(web.getUrl())))
                  || !Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                request.deny(); return;
              }
              cancelMicrophone();
              microphone = request; microphoneOrigin = request.getOrigin();
              if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                grantMicrophone();
              } else {microphonePrompt = true;requestPermissions(new String[] {android.Manifest.permission.RECORD_AUDIO}, MICROPHONE);}
            });
          }

          @Override
          public void onPermissionRequestCanceled(PermissionRequest request) {
            if (microphone == request) cancelMicrophone();
          }

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
    feedback = new FeedbackBridge(this);
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
    web.loadUrl((pendingKiteCallback==null&&pendingUpstoxCallback==null&&pendingAngelCallback==null)?startUrl():startUrl().split("#")[0]+"#holdings");
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

  private void acceptKiteIntent(Intent intent) {
    if (intent == null) return;
    Uri uri=intent.getData();
    intent.setData(null);
    if (uri==null || !connected() || !"fingent360".equals(uri.getScheme()) || (!"broker-kite".equals(uri.getHost())&&!"broker-upstox".equals(uri.getHost())&&!"broker-angel".equals(uri.getHost())) || uri.getPort()!=-1 || uri.getUserInfo()!=null || uri.getFragment()!=null || (uri.getPath()!=null&&!uri.getPath().isEmpty()) || uri.toString().length()>4500) return;
    try {
      boolean upstox="broker-upstox".equals(uri.getHost()),angel="broker-angel".equals(uri.getHost());
      String parameter=angel?"auth_token":upstox?"code":"request_token";
      Set<String> names=uri.getQueryParameterNames();
      if(names.size()!=2||!names.contains("state")||!names.contains(parameter)||uri.getQueryParameters("state").size()!=1||uri.getQueryParameters(parameter).size()!=1) return;
      String state=uri.getQueryParameter("state"), token=uri.getQueryParameter(parameter);
      if(state==null||token==null||!state.matches("[a-f0-9]{64}")||!token.matches(angel?"[A-Za-z0-9._~-]{8,4096}":upstox?"[A-Za-z0-9._~-]{1,512}":"[A-Za-z0-9_-]{8,256}"))return;
      JSONObject callback=new JSONObject().put("state",state).put(angel?"authToken":upstox?"code":"requestToken",token);
      if(angel){pendingAngelCallback=callback;pendingAngelUntil=System.currentTimeMillis()+600000;}
      else if(upstox){pendingUpstoxCallback=callback;pendingUpstoxUntil=System.currentTimeMillis()+600000;}
      else {pendingKiteCallback=callback;pendingKiteUntil=System.currentTimeMillis()+600000;}
    } catch(Exception ignored) { pendingKiteCallback=null;pendingUpstoxCallback=null;pendingAngelCallback=null; }
  }
  @Override protected void onNewIntent(Intent intent){
    super.onNewIntent(intent);acceptKiteIntent(intent);
    if((pendingKiteCallback!=null||pendingUpstoxCallback!=null||pendingAngelCallback!=null)&&web!=null&&web.getUrl()!=null&&trusted(Uri.parse(web.getUrl())))web.evaluateJavascript("location.hash='holdings';window.dispatchEvent(new Event('f360-kite-ready'));window.dispatchEvent(new Event('f360-upstox-ready'));window.dispatchEvent(new Event('f360-angel-ready'));",null);
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
            if (action.equals("feedbackRead") || action.equals("feedbackWrite") || action.equals("sendFeedback") || action.equals("captureFeedback")) {
              String requestId = data.getString("requestId");
              if (!requestId.matches("[A-Za-z0-9_-]{1,100}")) throw new Exception();
              final long generation = pageGeneration;
              java.util.function.Consumer<JSONObject> deliver = payload -> runOnUiThread(() -> {
                if (web == null || isFinishing() || isDestroyed() || generation != pageGeneration || web.getUrl() == null || !trusted(Uri.parse(web.getUrl()))) return;
                reply.postMessage(payload.toString());
              });
              if (action.equals("captureFeedback")) {
                try {deliver.accept(new JSONObject().put("requestId", requestId).put("ok", true).put("result", FeedbackBridge.capture(web)));}
                catch (Exception captureError) {deliver.accept(new JSONObject().put("requestId", requestId).put("ok", false).put("error", captureError.getMessage()));}
              } else feedback.handle(data, deliver);
            }
            else if (action.equals("takeKiteCallback")) {
              String requestId=data.getString("requestId");
              if(!requestId.matches("[A-Za-z0-9_-]{1,100}"))throw new Exception();
              Object result=connected()&&pendingKiteCallback!=null&&pendingKiteUntil>System.currentTimeMillis()?pendingKiteCallback:JSONObject.NULL;
              pendingKiteCallback=null;pendingKiteUntil=0;
              reply.postMessage(new JSONObject().put("requestId",requestId).put("ok",true).put("result",result).toString());
            }
            else if (action.equals("takeUpstoxCallback")) {
              String requestId=data.getString("requestId");
              if(!requestId.matches("[A-Za-z0-9_-]{1,100}"))throw new Exception();
              Object result=connected()&&pendingUpstoxCallback!=null&&pendingUpstoxUntil>System.currentTimeMillis()?pendingUpstoxCallback:JSONObject.NULL;
              pendingUpstoxCallback=null;pendingUpstoxUntil=0;
              reply.postMessage(new JSONObject().put("requestId",requestId).put("ok",true).put("result",result).toString());
            }
            else if (action.equals("takeAngelCallback")) {
              String requestId=data.getString("requestId");
              if(!requestId.matches("[A-Za-z0-9_-]{1,100}"))throw new Exception();
              Object result=connected()&&pendingAngelCallback!=null&&pendingAngelUntil>System.currentTimeMillis()?pendingAngelCallback:JSONObject.NULL;
              pendingAngelCallback=null;pendingAngelUntil=0;
              reply.postMessage(new JSONObject().put("requestId",requestId).put("ok",true).put("result",result).toString());
            }
            else if (action.equals("sharePublicLink")) {
              String requestId = data.getString("requestId");
              if (!requestId.matches("[A-Za-z0-9_-]{1,100}")) throw new Exception();
              sharePublicLink(data.getString("url"));
              reply.postMessage(new JSONObject().put("requestId",requestId).put("ok",true).put("result",new JSONObject().put("opened",true)).toString());
            }
            else if (action.equals("saveFile")) saveFile(data);
            else if (action.equals("setConnection")) setConnection(data);
          } catch (Exception e) {
            try {
              String requestId = new JSONObject(message.getData()).optString("requestId");
              if (requestId.matches("[A-Za-z0-9_-]{1,100}")) reply.postMessage(new JSONObject().put("requestId", requestId).put("ok", false).put("error", "Invalid native request.").toString());
              else event(action, "failed", "Invalid native request.");
            } catch (Exception ignored) {event(action, "failed", "Invalid native request.");}
          }
        });
    String script =
        "if(window.top===window){(function(){var pending=new Map();var counter=0;"
            + "FingentNative.onmessage=function(event){var value;try{value=JSON.parse(event.data);}catch(e){return;}var item=pending.get(value.requestId);if(!item)return;clearTimeout(item.timer);pending.delete(value.requestId);if(value.ok)item.resolve(value.result);else item.reject(new Error(value.error||'Native feedback failed.'));};"
            + "function call(action,args){return new Promise(function(resolve,reject){var requestId='feedback_'+Date.now()+'_'+(++counter);var timer=setTimeout(function(){pending.delete(requestId);reject(new Error('Native feedback timed out. Reload history before retrying.'));},120000);pending.set(requestId,{resolve:resolve,reject:reject,timer:timer});try{FingentNative.postMessage(JSON.stringify(Object.assign({},args,{action:action,requestId:requestId})));}catch(error){clearTimeout(timer);pending.delete(requestId);reject(error);}});}"
            + "window.addEventListener('pagehide',function(){pending.forEach(function(item){clearTimeout(item.timer);item.reject(new Error('App page changed. Reopen feedback history.'));});pending.clear();});"
            + "window.FingentAndroid=Object.freeze({takeAngelCallback:function(){return call('takeAngelCallback',{});},takeUpstoxCallback:function(){return call('takeUpstoxCallback',{});},takeKiteCallback:function(){return call('takeKiteCallback',{});},sharePublicLink:function(url){return call('sharePublicLink',{url:url});},feedbackRead:function(){return call('feedbackRead',{});},feedbackWrite:function(expectedRevision,state){return call('feedbackWrite',{expectedRevision:expectedRevision,state:state});},captureFeedback:function(){return call('captureFeedback',{});},sendFeedback:function(apiOrigin,method,id,receiptToken,body){return call('sendFeedback',{apiOrigin:apiOrigin,method:method,id:id,receiptToken:receiptToken,body:body});},getConfig:function(){return "
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
            + ";},saveFile:function(filename,mime,base64){FingentNative.postMessage(JSON.stringify({action:'saveFile',filename:filename,mime:mime,base64:base64}));},setConnection:function(mode,webUrl,apiUrl){FingentNative.postMessage(JSON.stringify({action:'setConnection',mode:mode,webUrl:webUrl,apiUrl:apiUrl}));}});})();}";
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

  private void sharePublicLink(String value) throws Exception {
    Uri uri = Uri.parse(value);
    String host = uri.getHost();
    if (host != null) host = host.toLowerCase(java.util.Locale.ROOT).replaceAll("\\.$", "");
    if (!connected() || value.length()>2000 || !"https".equals(uri.getScheme()) || host==null ||
        !host.contains(".") || host.matches("[0-9.]+") || host.contains(":") ||
        host.equals("appassets.androidplatform.net") || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid") ||
        !origin(uri).equals(origin(Uri.parse(config.getString("webUrl")))) ||
        uri.getUserInfo()!=null || uri.getQuery()!=null || !"/".equals(uri.getPath()) ||
        uri.getFragment()==null || !uri.getFragment().matches("read/[a-z0-9][a-z0-9-]{0,99}")) throw new Exception();
    Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,value);
    startActivity(Intent.createChooser(share,"Share public reading"));
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

  private void cancelMicrophone() {
    if (microphone != null) {microphone.deny();microphone = null;}
    microphoneOrigin = null;
  }

  private void grantMicrophone() {
    PermissionRequest request = microphone;
    Uri requestedOrigin = microphoneOrigin;
    microphone = null; microphoneOrigin = null;
    if (request == null) return;
    if (web != null && web.getUrl() != null && requestedOrigin != null
        && trusted(requestedOrigin) && trusted(Uri.parse(web.getUrl()))
        && origin(requestedOrigin).equals(origin(Uri.parse(web.getUrl()))))
      request.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
    else request.deny();
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
    super.onRequestPermissionsResult(requestCode, permissions, grants);
    if (requestCode == MICROPHONE) {
      microphonePrompt = false;
      if (!activityStopped && grants.length > 0 && grants[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) grantMicrophone();
      else cancelMicrophone();
    }
  }

  @Override
  protected void onPause() {
    // Android's runtime permission activity can pause this activity. Do not
    // cancel the pending microphone request merely because its own prompt opened.
    if (!microphonePrompt) cancelMicrophone();
    if (web != null) {
      if (!microphonePrompt) web.evaluateJavascript("window.dispatchEvent(new Event('f360-pause'))", null);
      web.onPause();
      web.pauseTimers();
    }
    super.onPause();
  }

  @Override
  protected void onStart() {
    super.onStart();
    activityStopped = false;
  }

  @Override
  protected void onStop() {
    activityStopped = true;
    cancelMicrophone();
    if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('f360-pause'))", null);
    super.onStop();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (web != null) {
      web.onResume();
      web.resumeTimers();
      web.evaluateJavascript("window.dispatchEvent(new Event('f360-resume'))", null);
    }
  }

  @Override
  protected void onDestroy() {
    if (fileChoice != null) fileChoice.onReceiveValue(null);
    exportData = null;
    cancelMicrophone();
    if (feedback != null) feedback.close();
    if (web != null) {
      web.stopLoading();
      web.destroy();
    }
    super.onDestroy();
  }
}

package com.fingent360.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.util.AtomicFile;
import android.util.Base64;
import android.webkit.WebView;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/** App-private feedback only. No financial records or WebView cookies enter this bridge. */
final class FeedbackBridge {
  private static final int STORE_LIMIT = 40 * 1024 * 1024;
  private static final int NETWORK_LIMIT = 8_500_000;
  private static final Object STORE_LOCK = new Object();
  private final AtomicFile file;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final java.util.concurrent.ScheduledExecutorService deadlines = Executors.newSingleThreadScheduledExecutor();
  private volatile boolean closed;
  private volatile HttpsURLConnection connection;

  FeedbackBridge(Activity activity) {

    file = new AtomicFile(new File(activity.getFilesDir(), "feedback-outbox-v1.json"));
  }

  static String apiOrigin(String input) throws Exception {
    Uri value = Uri.parse(input);
    if (!"https".equals(value.getScheme()) || value.getHost() == null
        || value.getUserInfo() != null || value.getQuery() != null || value.getFragment() != null
        || (value.getPath() != null && !value.getPath().isEmpty() && !"/".equals(value.getPath()))
        || "appassets.androidplatform.net".equals(value.getHost()))
      throw new IOException("Choose an HTTPS feedback API origin without credentials or a path.");
    return "https://" + value.getHost() + (value.getPort() == -1 ? "" : ":" + value.getPort());
  }

  private static void keys(JSONObject object, String... allowed) throws Exception {
    java.util.Set<String> set = new java.util.HashSet<>(java.util.Arrays.asList(allowed));
    Iterator<String> keys = object.keys();
    while (keys.hasNext()) if (!set.contains(keys.next())) throw new IOException("Invalid feedback storage fields.");
  }

  private static JSONObject checkedState(JSONObject state) throws Exception {
    keys(state, "records", "config");
    JSONArray records = state.getJSONArray("records");
    if (records.length() > 100) throw new IOException("Keep at most 100 feedback records on this device.");
    for (int i = 0; i < records.length(); i++) {
      JSONObject record = records.getJSONObject(i);
      if (!(record.opt("submission") instanceof JSONObject) || !(record.opt("state") instanceof String)) throw new IOException("Invalid feedback record.");
    }
    JSONObject config = state.getJSONObject("config");
    keys(config, "enabled", "apiOrigin");
    Object enabled = config.get("enabled");
    if (!(enabled instanceof Boolean) || !(config.get("apiOrigin") instanceof String))
      throw new IOException("Invalid feedback destination setting.");
    String origin = config.getString("apiOrigin");
    if (!origin.isEmpty()) config.put("apiOrigin", apiOrigin(origin));
    if (config.getBoolean("enabled") && origin.isEmpty()) throw new IOException("Choose a feedback destination before enabling delivery.");
    if (state.toString().getBytes(StandardCharsets.UTF_8).length > STORE_LIMIT - 1024)
      throw new IOException("Feedback storage is full. Remove an older record or attachment.");
    return state;
  }

  private JSONObject read() throws Exception { synchronized (STORE_LOCK) { return readLocked(); } }

  private JSONObject readLocked() throws Exception {
    if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath() + ".bak").exists())
      return new JSONObject().put("revision", 0).put("records", new JSONArray())
          .put("config", new JSONObject().put("enabled", false).put("apiOrigin", ""));
    try (InputStream input = file.openRead()) {
      JSONObject root = new JSONObject(new String(bounded(input, STORE_LIMIT), StandardCharsets.UTF_8));
      keys(root, "revision", "records", "config");
      long revision = root.getLong("revision");
      if (revision < 0 || revision > 9007199254740990L || root.getDouble("revision") != revision)
        throw new IOException("Invalid feedback storage revision.");
      checkedState(new JSONObject().put("records", root.getJSONArray("records")).put("config", root.getJSONObject("config")));
      return root;
    } catch (Exception e) {
      throw new IOException("Feedback storage could not be read. Your saved data was not reset.", e);
    }
  }

  private JSONObject write(long expected, JSONObject state) throws Exception { synchronized (STORE_LOCK) { return writeLocked(expected, state); } }

  private JSONObject writeLocked(long expected, JSONObject state) throws Exception {
    JSONObject current = read();
    if (expected != current.getLong("revision")) throw new IOException("Feedback changed in another view. Reload and retry.");
    checkedState(state);
    long next = expected + 1;
    if (next > 9007199254740990L) throw new IOException("Feedback revision limit reached.");
    JSONObject root = new JSONObject().put("revision", next).put("records", state.getJSONArray("records")).put("config", state.getJSONObject("config"));
    FileOutputStream output = null;
    try {
      output = file.startWrite();
      output.write(root.toString().getBytes(StandardCharsets.UTF_8));
      file.finishWrite(output);
    } catch (Exception e) {
      if (output != null) file.failWrite(output);
      throw new IOException("Feedback could not be saved. Check device space and retry; earlier records are preserved.", e);
    }
    return new JSONObject().put("revision", next);
  }

  private static byte[] bounded(InputStream input, int limit) throws Exception {
    if (input == null) return new byte[0];
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] bytes = new byte[8192]; int count;
    while ((count = input.read(bytes)) != -1) {
      if (output.size() + count > limit) throw new IOException("Feedback data exceeds the supported size.");
      output.write(bytes, 0, count);
    }
    return output.toByteArray();
  }

  private JSONObject send(JSONObject data) throws Exception {
    String destination = apiOrigin(data.getString("apiOrigin"));
    JSONObject config = read().getJSONObject("config");
    if (!config.getBoolean("enabled") || !destination.equals(config.getString("apiOrigin")))
      throw new IOException("Enable this exact feedback destination in Feedback settings before sending.");
    String method = data.getString("method");
    String id = data.isNull("id") ? null : data.optString("id", null);
    String token = data.isNull("receiptToken") ? null : data.optString("receiptToken", null);
    if (!java.util.Arrays.asList("GET", "POST", "DELETE").contains(method)) throw new IOException("Invalid feedback method.");
    if (method.equals("POST")) {
      if (id != null || token != null) throw new IOException("Invalid submission path.");
    } else if (id == null || !id.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
        || token == null || !token.matches("[a-f0-9]{64}")) throw new IOException("A feedback receipt is required.");
    HttpsURLConnection request = (HttpsURLConnection) new URL(destination + "/api/v1/feedback" + (id == null ? "" : "/" + id)).openConnection();
    connection = request;
    java.util.concurrent.ScheduledFuture<?> deadline = deadlines.schedule(request::disconnect, 30, java.util.concurrent.TimeUnit.SECONDS);
    request.setInstanceFollowRedirects(false);
    request.setConnectTimeout(30000); request.setReadTimeout(30000);
    request.setRequestMethod(method);
    request.setUseCaches(false);
    request.setRequestProperty("Accept", "application/json");
    request.setRequestProperty("Cookie", "");
    request.setRequestProperty("Origin", "https://appassets.androidplatform.net");
    if (token != null) request.setRequestProperty("X-Feedback-Token", token);
    try {
      if (method.equals("POST")) {
        Object body = data.get("body");
        if (!(body instanceof JSONObject)) throw new IOException("Invalid feedback submission.");
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > NETWORK_LIMIT) throw new IOException("Feedback submission is too large.");
        request.setDoOutput(true); request.setFixedLengthStreamingMode(bytes.length);
        request.setRequestProperty("Content-Type", "application/json");
        try (OutputStream output = request.getOutputStream()) {output.write(bytes);}
      }
      int status = request.getResponseCode();
      if (status >= 300 && status < 400) throw new IOException("Feedback redirects are not followed. Check the configured API origin.");
      String text;
      try (InputStream input = status >= 400 ? request.getErrorStream() : request.getInputStream()) {
        text = new String(bounded(input, NETWORK_LIMIT), StandardCharsets.UTF_8);
      }
      Object result;
      try {result = text.isEmpty() ? JSONObject.NULL : new JSONTokener(text).nextValue();}
      catch (Exception e) {throw new IOException("Feedback server returned an unreadable response.");}
      if (!(result instanceof JSONObject) && !(result instanceof JSONArray) && result != JSONObject.NULL)
        throw new IOException("Feedback server returned an unreadable response.");
      return new JSONObject().put("status", status).put("body", result);
    } finally {deadline.cancel(false);request.disconnect();connection = null;}
  }

  void handle(JSONObject data, Consumer<JSONObject> reply) {
    if (closed) return;
    worker.execute(() -> {
      try {
        Object result;
        switch (data.getString("action")) {
          case "feedbackRead": result = read(); break;
          case "feedbackWrite":
            double expected = data.getDouble("expectedRevision");
            if (expected < 0 || expected != Math.floor(expected) || expected > 9007199254740990L) throw new IOException("Invalid expected revision.");
            result = write((long)expected, data.getJSONObject("state")); break;
          case "sendFeedback": result = send(data); break;
          default: throw new IOException("Unsupported feedback request.");
        }
        reply.accept(new JSONObject().put("requestId", data.getString("requestId")).put("ok", true).put("result", result));
      } catch (Exception error) {
        try {reply.accept(new JSONObject().put("requestId", data.optString("requestId")).put("ok", false).put("error", error.getMessage() == null ? "Feedback request failed." : error.getMessage()));}
        catch (Exception ignored) { }
      }
    });
  }

  static String capture(WebView web) throws Exception {
    int width = web.getWidth(), height = web.getHeight();
    if (width < 1 || height < 1) throw new IOException("The app viewport is not ready to capture.");
    double scale = Math.min(Math.min(1d, 4096d / Math.max(width, height)), Math.sqrt(4_000_000d / ((double)width * height)));
    Bitmap image = Bitmap.createBitmap(Math.max(1, (int)(width * scale)), Math.max(1, (int)(height * scale)), Bitmap.Config.ARGB_8888);
    try {
      Canvas canvas = new Canvas(image); canvas.scale((float)scale, (float)scale); web.draw(canvas);
      for (int attempt = 0; attempt < 5; attempt++) {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        image.compress(Bitmap.CompressFormat.PNG, 100, output);
        if (output.size() <= 2_000_000) return "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        if (image.getWidth() < 128 || image.getHeight() < 128) break;
        Bitmap smaller = Bitmap.createScaledBitmap(image, Math.max(1, image.getWidth()*3/4), Math.max(1,image.getHeight()*3/4), true);
        image.recycle(); image = smaller;
      }
      throw new IOException("This screenshot is too large. Try a smaller viewport or feedback without a screenshot.");
    } finally {image.recycle();}
  }

  void close() {closed = true; HttpsURLConnection active = connection; if(active != null) active.disconnect(); worker.shutdownNow(); deadlines.shutdownNow();}
}

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The game itself lives in /spades.html at the repo root. It is copied in as
// the app's index.html at build time so there is only one source of truth.
val webDir = layout.buildDirectory.dir("generated/web").get().asFile
val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.file("spades.html")) { rename { "index.html" } }
    into(webDir)
}

android {
    namespace = "com.orangitaz.spades"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.orangitaz.spades"
        minSdk = 26
        targetSdk = 34
        // CI passes these in; defaults are used for local Android Studio builds.
        versionCode = (findProperty("appVersionCode") as String?)?.toInt() ?: 1
        versionName = (findProperty("appVersion") as String?) ?: "1.0.0"
    }

    sourceSets.getByName("main").assets.srcDir(webDir)

    signingConfigs {
        create("release") {
            // Set by the GitHub workflow from repository secrets.
            val ks = System.getenv("KEYSTORE_FILE")
            if (ks != null) {
                storeFile = file(ks)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Without signing secrets, fall back to the debug key so the APK still installs.
            signingConfig = if (System.getenv("KEYSTORE_FILE") != null)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}

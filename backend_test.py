#!/usr/bin/env python3
"""
Chrome Extension Structure and Code Validation Test
Tests the SEFAZ NF-e Editor Chrome Extension for structural integrity and code quality
"""

import json
import os
import re
import sys
from pathlib import Path

class ChromeExtensionTester:
    def __init__(self, extension_path="/app/chrome-extension"):
        self.extension_path = Path(extension_path)
        self.tests_run = 0
        self.tests_passed = 0
        self.issues = []
        
    def log_test(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")
                self.issues.append(f"{name}: {details}")
    
    def test_file_structure(self):
        """Test 1: Verify Chrome Extension file structure"""
        print("\n🔍 Testing Chrome Extension File Structure...")
        
        required_files = [
            "manifest.json",
            "popup.html", 
            "popup.js",
            "popup.css",
            "content.js",
            "content-styles.css",
            "README.md"
        ]
        
        required_icons = [
            "icons/icon16.png",
            "icons/icon32.png", 
            "icons/icon48.png",
            "icons/icon128.png"
        ]
        
        # Check main files
        for file in required_files:
            file_path = self.extension_path / file
            self.log_test(
                f"File exists: {file}",
                file_path.exists(),
                f"Missing required file: {file}"
            )
        
        # Check icon files
        for icon in required_icons:
            icon_path = self.extension_path / icon
            self.log_test(
                f"Icon exists: {icon}",
                icon_path.exists(),
                f"Missing required icon: {icon}"
            )
    
    def test_manifest_json(self):
        """Test 2: Validate manifest.json for Manifest V3 compliance"""
        print("\n🔍 Testing manifest.json...")
        
        manifest_path = self.extension_path / "manifest.json"
        if not manifest_path.exists():
            self.log_test("manifest.json exists", False, "File not found")
            return
        
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
            
            # Test Manifest V3
            self.log_test(
                "Manifest V3 compliance",
                manifest.get("manifest_version") == 3,
                f"Expected manifest_version 3, got {manifest.get('manifest_version')}"
            )
            
            # Test required fields
            required_fields = ["name", "version", "description"]
            for field in required_fields:
                self.log_test(
                    f"Has required field: {field}",
                    field in manifest,
                    f"Missing required field: {field}"
                )
            
            # Test permissions
            permissions = manifest.get("permissions", [])
            required_permissions = ["activeTab", "scripting", "clipboardWrite"]
            for perm in required_permissions:
                self.log_test(
                    f"Has permission: {perm}",
                    perm in permissions,
                    f"Missing permission: {perm}"
                )
            
            # Test host permissions
            host_permissions = manifest.get("host_permissions", [])
            expected_host = "https://nfe-extranet.sefazrs.rs.gov.br/*"
            self.log_test(
                "Has SEFAZ host permission",
                expected_host in host_permissions,
                f"Missing host permission for SEFAZ: {expected_host}"
            )
            
            # Test action (popup)
            action = manifest.get("action", {})
            self.log_test(
                "Has popup configuration",
                "default_popup" in action and action["default_popup"] == "popup.html",
                "Missing or incorrect popup configuration"
            )
            
            # Test content scripts
            content_scripts = manifest.get("content_scripts", [])
            self.log_test(
                "Has content scripts",
                len(content_scripts) > 0,
                "No content scripts defined"
            )
            
            if content_scripts:
                cs = content_scripts[0]
                self.log_test(
                    "Content script targets SEFAZ",
                    "https://nfe-extranet.sefazrs.rs.gov.br/*" in cs.get("matches", []),
                    "Content script doesn't target SEFAZ website"
                )
                
                self.log_test(
                    "Content script includes JS",
                    "content.js" in cs.get("js", []),
                    "Content script missing content.js"
                )
                
                self.log_test(
                    "Content script includes CSS",
                    "content-styles.css" in cs.get("css", []),
                    "Content script missing content-styles.css"
                )
            
        except json.JSONDecodeError as e:
            self.log_test("manifest.json valid JSON", False, f"JSON parse error: {e}")
        except Exception as e:
            self.log_test("manifest.json readable", False, f"Error reading file: {e}")
    
    def test_popup_html(self):
        """Test 3: Validate popup.html structure"""
        print("\n🔍 Testing popup.html...")
        
        popup_path = self.extension_path / "popup.html"
        if not popup_path.exists():
            self.log_test("popup.html exists", False, "File not found")
            return
        
        try:
            with open(popup_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Test basic HTML structure
            self.log_test(
                "Valid HTML document",
                "<!DOCTYPE html>" in html_content and "<html" in html_content,
                "Missing DOCTYPE or html tag"
            )
            
            # Test required elements for date inputs
            date_elements = [
                'id="dateStart"',
                'id="dateEnd"',
                'data-testid="date-start-input"',
                'data-testid="date-end-input"'
            ]
            
            for element in date_elements:
                self.log_test(
                    f"Has date input element: {element}",
                    element in html_content,
                    f"Missing date input element: {element}"
                )
            
            # Test required buttons
            buttons = [
                'id="executeBtn"',
                'data-testid="execute-btn"',
                'id="copyTotalBtn"',
                'data-testid="copy-total-btn"',
                'id="refreshProducts"',
                'data-testid="refresh-products-btn"'
            ]
            
            for button in buttons:
                self.log_test(
                    f"Has button: {button}",
                    button in html_content,
                    f"Missing button: {button}"
                )
            
            # Test product list container
            self.log_test(
                "Has products list container",
                'id="productsList"' in html_content,
                "Missing products list container"
            )
            
            # Test CSS and JS includes
            self.log_test(
                "Includes popup.css",
                'href="popup.css"' in html_content,
                "Missing popup.css link"
            )
            
            self.log_test(
                "Includes popup.js",
                'src="popup.js"' in html_content,
                "Missing popup.js script"
            )
            
            # Test data-testid attributes for testing
            testid_count = html_content.count('data-testid=')
            self.log_test(
                "Has data-testid attributes",
                testid_count >= 5,
                f"Expected at least 5 data-testid attributes, found {testid_count}"
            )
            
        except Exception as e:
            self.log_test("popup.html readable", False, f"Error reading file: {e}")
    
    def test_popup_js(self):
        """Test 4: Validate popup.js functionality"""
        print("\n🔍 Testing popup.js...")
        
        popup_js_path = self.extension_path / "popup.js"
        if not popup_js_path.exists():
            self.log_test("popup.js exists", False, "File not found")
            return
        
        try:
            with open(popup_js_path, 'r', encoding='utf-8') as f:
                js_content = f.read()
            
            # Test date formatting logic
            date_format_patterns = [
                r'formatDateInput',
                r'DD/MM',
                r'slice\(0,\s*2\)',
                r'slice\(2,\s*4\)'
            ]
            
            for pattern in date_format_patterns:
                self.log_test(
                    f"Has date formatting logic: {pattern}",
                    re.search(pattern, js_content) is not None,
                    f"Missing date formatting pattern: {pattern}"
                )
            
            # Test Chrome extension API usage
            chrome_apis = [
                'chrome.tabs.query',
                'chrome.tabs.sendMessage',
                'chrome.runtime.onMessage'
            ]
            
            for api in chrome_apis:
                self.log_test(
                    f"Uses Chrome API: {api}",
                    api in js_content,
                    f"Missing Chrome API usage: {api}"
                )
            
            # Test required functions
            required_functions = [
                'checkConnection',
                'loadProducts',
                'executeAutomation',
                'formatDateInput',
                'updateDatePreview',
                'copyTotal'
            ]
            
            for func in required_functions:
                pattern = rf'(function\s+{func}|{func}\s*[:=]\s*function|{func}\s*\()'
                self.log_test(
                    f"Has function: {func}",
                    re.search(pattern, js_content) is not None,
                    f"Missing function: {func}"
                )
            
            # Test event listeners setup
            event_patterns = [
                r'addEventListener',
                r'DOMContentLoaded',
                r'click',
                r'input'
            ]
            
            for pattern in event_patterns:
                self.log_test(
                    f"Has event handling: {pattern}",
                    re.search(pattern, js_content) is not None,
                    f"Missing event handling: {pattern}"
                )
            
            # Test clipboard API usage
            self.log_test(
                "Has clipboard functionality",
                'navigator.clipboard.writeText' in js_content,
                "Missing clipboard functionality"
            )
            
        except Exception as e:
            self.log_test("popup.js readable", False, f"Error reading file: {e}")
    
    def test_content_js(self):
        """Test 5: Validate content.js functionality"""
        print("\n🔍 Testing content.js...")
        
        content_js_path = self.extension_path / "content.js"
        if not content_js_path.exists():
            self.log_test("content.js exists", False, "File not found")
            return
        
        try:
            with open(content_js_path, 'r', encoding='utf-8') as f:
                js_content = f.read()
            
            # Test required main functions
            required_functions = [
                'getProducts',
                'updateDateRange', 
                'editProduct',
                'getTotalValue'
            ]
            
            for func in required_functions:
                pattern = rf'(function\s+{func}|{func}\s*[:=]\s*function|async\s+function\s+{func})'
                self.log_test(
                    f"Has function: {func}",
                    re.search(pattern, js_content) is not None,
                    f"Missing required function: {func}"
                )
            
            # Test message listener
            self.log_test(
                "Has message listener",
                'chrome.runtime.onMessage.addListener' in js_content,
                "Missing Chrome runtime message listener"
            )
            
            # Test helper functions
            helper_functions = [
                'clickTab',
                'findButtonByText',
                'findInputByLabel',
                'waitForElement',
                'sleep',
                'parseValue',
                'formatCurrency'
            ]
            
            for func in helper_functions:
                pattern = rf'(function\s+{func}|{func}\s*[:=]\s*function)'
                self.log_test(
                    f"Has helper function: {func}",
                    re.search(pattern, js_content) is not None,
                    f"Missing helper function: {func}"
                )
            
            # Test DOM manipulation patterns
            dom_patterns = [
                r'document\.querySelector',
                r'document\.querySelectorAll',
                r'addEventListener',
                r'dispatchEvent'
            ]
            
            for pattern in dom_patterns:
                self.log_test(
                    f"Has DOM manipulation: {pattern}",
                    re.search(pattern, js_content) is not None,
                    f"Missing DOM manipulation: {pattern}"
                )
            
            # Test async/await usage
            self.log_test(
                "Uses async/await",
                'async function' in js_content and 'await ' in js_content,
                "Missing async/await patterns"
            )
            
            # Test error handling
            self.log_test(
                "Has error handling",
                'try {' in js_content and 'catch' in js_content,
                "Missing try/catch error handling"
            )
            
        except Exception as e:
            self.log_test("content.js readable", False, f"Error reading file: {e}")
    
    def test_popup_css(self):
        """Test 6: Validate popup.css dark theme"""
        print("\n🔍 Testing popup.css...")
        
        css_path = self.extension_path / "popup.css"
        if not css_path.exists():
            self.log_test("popup.css exists", False, "File not found")
            return
        
        try:
            with open(css_path, 'r', encoding='utf-8') as f:
                css_content = f.read()
            
            # Test CSS variables (dark theme)
            dark_theme_vars = [
                '--bg-primary',
                '--bg-secondary', 
                '--text-primary',
                '--text-secondary',
                '--accent-primary'
            ]
            
            for var in dark_theme_vars:
                self.log_test(
                    f"Has CSS variable: {var}",
                    var in css_content,
                    f"Missing CSS variable: {var}"
                )
            
            # Test dark color values
            dark_colors = [
                '#0f1419',  # bg-primary
                '#192029',  # bg-secondary
                '#e7e9ea'   # text-primary
            ]
            
            for color in dark_colors:
                self.log_test(
                    f"Has dark theme color: {color}",
                    color in css_content,
                    f"Missing dark theme color: {color}"
                )
            
            # Test responsive design
            responsive_patterns = [
                r'width:\s*360px',
                r'min-height:\s*480px',
                r'flex',
                r'gap:'
            ]
            
            for pattern in responsive_patterns:
                self.log_test(
                    f"Has responsive design: {pattern}",
                    re.search(pattern, css_content) is not None,
                    f"Missing responsive design pattern: {pattern}"
                )
            
            # Test animations
            animation_patterns = [
                r'@keyframes',
                r'animation:',
                r'transition:'
            ]
            
            for pattern in animation_patterns:
                self.log_test(
                    f"Has animations: {pattern}",
                    re.search(pattern, css_content) is not None,
                    f"Missing animation pattern: {pattern}"
                )
            
            # Test component styles
            components = [
                '.header',
                '.main-content',
                '.section',
                '.btn-primary',
                '.product-item',
                '.progress-bar'
            ]
            
            for component in components:
                self.log_test(
                    f"Has component style: {component}",
                    component in css_content,
                    f"Missing component style: {component}"
                )
            
        except Exception as e:
            self.log_test("popup.css readable", False, f"Error reading file: {e}")
    
    def test_content_styles_css(self):
        """Test 7: Validate content-styles.css"""
        print("\n🔍 Testing content-styles.css...")
        
        css_path = self.extension_path / "content-styles.css"
        if not css_path.exists():
            self.log_test("content-styles.css exists", False, "File not found")
            return
        
        try:
            with open(css_path, 'r', encoding='utf-8') as f:
                css_content = f.read()
            
            # Test minimal interference approach
            self.log_test(
                "Has minimal styles comment",
                "minimal" in css_content.lower() and "interfering" in css_content.lower(),
                "Missing comment about minimal interference"
            )
            
            # Test extension-specific classes
            extension_classes = [
                '.sefaz-editor-active',
                '.sefaz-editor-selected',
                '.sefaz-editor-overlay'
            ]
            
            for cls in extension_classes:
                self.log_test(
                    f"Has extension class: {cls}",
                    cls in css_content,
                    f"Missing extension-specific class: {cls}"
                )
            
            # Test !important usage (necessary for content scripts)
            self.log_test(
                "Uses !important for overrides",
                '!important' in css_content,
                "Missing !important declarations for content script styles"
            )
            
        except Exception as e:
            self.log_test("content-styles.css readable", False, f"Error reading file: {e}")
    
    def test_readme(self):
        """Test 8: Validate README.md documentation"""
        print("\n🔍 Testing README.md...")
        
        readme_path = self.extension_path / "README.md"
        if not readme_path.exists():
            self.log_test("README.md exists", False, "File not found")
            return
        
        try:
            with open(readme_path, 'r', encoding='utf-8') as f:
                readme_content = f.read()
            
            # Test required sections
            required_sections = [
                "# SEFAZ NF-e Editor",
                "## Funcionalidades",
                "## Como Instalar",
                "## Como Usar",
                "## Estrutura de Arquivos"
            ]
            
            for section in required_sections:
                self.log_test(
                    f"Has section: {section}",
                    section in readme_content,
                    f"Missing documentation section: {section}"
                )
            
            # Test installation instructions
            install_keywords = [
                "chrome://extensions/",
                "Modo do desenvolvedor",
                "Carregar sem compactação"
            ]
            
            for keyword in install_keywords:
                self.log_test(
                    f"Has install instruction: {keyword}",
                    keyword in readme_content,
                    f"Missing installation instruction: {keyword}"
                )
            
            # Test usage instructions
            usage_keywords = [
                "nfe-extranet.sefazrs.rs.gov.br",
                "DD/MM",
                "Executar Alterações",
                "Copiar Valor"
            ]
            
            for keyword in usage_keywords:
                self.log_test(
                    f"Has usage instruction: {keyword}",
                    keyword in readme_content,
                    f"Missing usage instruction: {keyword}"
                )
            
        except Exception as e:
            self.log_test("README.md readable", False, f"Error reading file: {e}")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Chrome Extension Validation Tests...")
        print(f"📁 Extension path: {self.extension_path}")
        
        # Run all test methods
        self.test_file_structure()
        self.test_manifest_json()
        self.test_popup_html()
        self.test_popup_js()
        self.test_content_js()
        self.test_popup_css()
        self.test_content_styles_css()
        self.test_readme()
        
        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.issues:
            print(f"\n❌ Issues found ({len(self.issues)}):")
            for issue in self.issues:
                print(f"   • {issue}")
        else:
            print("\n✅ All tests passed! Chrome Extension structure is valid.")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = ChromeExtensionTester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
import React from "react";
import { useTranslation } from "react-i18next";
import '../../assets/scss/landing/navigation.scss';
import HTO_LOGO from '../../assets/img/icon/Hack_cat.png';

const Navigation: React.FC = () => {
  const { t, i18n } = useTranslation('landing');

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ko' ? 'en' : 'ko';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <nav id="menu" className="navbar navbar-default navbar-fixed-top">
      <div className="menu-container">
        <div className="navbar-header">
          <button
            type="button"
            className="navbar-toggle collapsed"
            data-toggle="collapse"
            data-target="#bs-example-navbar-collapse-1"
          >
            {" "}
            <span className="sr-only">Toggle navigation</span>{" "}
            <span className="icon-bar"></span>{" "}
            <span className="icon-bar"></span>{" "}
            <span className="icon-bar"></span>{" "}
          </button>
          <a
            className="navbar-brand page-scroll"
            href="#header"
            onClick={(e) => {
              e.preventDefault();
              toggleLanguage();
            }}
            title={i18n.language === 'ko' ? 'Switch to English' : '한국어로 전환'}
            style={{ cursor: 'pointer' }}
          >
            <img
              src={HTO_LOGO}
              alt="Hack This Out"
              className="logo-image"
            />
          </a>
        </div>

        <div
          className="collapse navbar-collapse"
          id="bs-example-navbar-collapse-1"
        >
          <ul className="nav navbar-nav navbar-right">
            <li>
              <a href="#features" className="page-scroll">
                {t('nav.features')}
              </a>
            </li>
            <li>
              <a href="#about" className="page-scroll">
                {t('nav.about')}
              </a>
            </li>
            <li>
              <a href="#services" className="page-scroll">
                {t('nav.services')}
              </a>
            </li>
            <li>
              <a href="#team" className="page-scroll">
                {t('nav.team')}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

import React from "react";
import { useTranslation } from "react-i18next";
import Navigation from "../../components/landing/navigation";
import { Header } from "../../components/landing/header";
import { Features } from "../../components/landing/features";
import { About } from "../../components/landing/about";
import { Services } from "../../components/landing/services";
import { Team } from "../../components/landing/team";
import { Contact } from "../../components/landing/contact";
import { landingPageData } from "../../data/landingPageData";

const LandingPage: React.FC = () => {
  const { t } = useTranslation('landing');

  // 번역된 데이터 생성
  const translatedData = {
    Header: {
      title: t('header.title'),
      paragraph: t('header.paragraph'),
      goToApp: t('header.goToApp')
    },
    Features: [
      {
        icon: landingPageData.Features[0].icon,
        title: t('features.userManagement.title'),
        text: t('features.userManagement.text')
      },
      {
        icon: landingPageData.Features[1].icon,
        title: t('features.virtualEnvironment.title'),
        text: t('features.virtualEnvironment.text')
      },
      {
        icon: landingPageData.Features[2].icon,
        title: t('features.gamingExperience.title'),
        text: t('features.gamingExperience.text')
      },
      {
        icon: landingPageData.Features[3].icon,
        title: t('features.userFriendly.title'),
        text: t('features.userFriendly.text')
      }
    ],
    About: {
      paragraph: t('about.paragraph'),
      Why: t('about.why', { returnObjects: true }) as string[],
      Why2: t('about.why2', { returnObjects: true }) as string[]
    },
    Services: [
      {
        icon: landingPageData.Services[0].icon,
        name: t('services.frontend.name'),
        text: t('services.frontend.text')
      },
      {
        icon: landingPageData.Services[1].icon,
        name: t('services.backend.name'),
        text: t('services.backend.text')
      },
      {
        icon: landingPageData.Services[2].icon,
        name: t('services.database.name'),
        text: t('services.database.text')
      },
      {
        icon: landingPageData.Services[3].icon,
        name: t('services.virtualMachines.name'),
        text: t('services.virtualMachines.text')
      },
      {
        icon: landingPageData.Services[4].icon,
        name: t('services.virtualNetwork.name'),
        text: t('services.virtualNetwork.text')
      },
      {
        icon: landingPageData.Services[5].icon,
        name: t('services.cicd.name'),
        text: t('services.cicd.text')
      }
    ],
    Team: landingPageData.Team,
    Contact: landingPageData.Contact
  };

  return (
    <div
      id="scroll-container"
      style={{
        overflowY: "scroll",
        height: "100vh",
        scrollBehavior: "smooth",
        scrollbarWidth: "none"
      }}
    >
      <div className="landingpage">
        <Navigation />
        <Header data={translatedData.Header} />
        <div id="features">
          <Features data={translatedData.Features} />
        </div>
        <div id="about">
          <About data={translatedData.About} />
        </div>
        <div id="services">
          <Services data={translatedData.Services} />
        </div>
        <div id="team">
          <Team data={translatedData.Team} />
        </div>
        <div>
          <Contact data={translatedData.Contact} />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
